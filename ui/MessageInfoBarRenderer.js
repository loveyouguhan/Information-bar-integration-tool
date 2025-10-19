/**
 * MessageInfoBarRenderer.js - 消息信息栏渲染器
 * 
 * 功能特性:
 * - 在AI消息结尾渲染折叠式信息栏界面
 * - 支持主题同步和交互功能
 * - 多NPC数据支持和面板管理
 * - 事件驱动的渲染机制
 * 
 * @version 1.0.0
 * @author Information Bar Integration Tool Developer
 */

export class MessageInfoBarRenderer {
    constructor(dependencies = {}) {
        // 🔧 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.configManager = dependencies.configManager || window.SillyTavernInfobar?.modules?.configManager;

        // 🚀 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        this.renderedMessages = new Set(); // 跟踪已渲染的消息ID
        this.currentTheme = null;
        this.frontendDisplayMode = false; // 前端显示模式标志
        this.interactiveInitialized = false; // 防止重复绑定全局交互事件

        // 🎨 HTML模板相关
        this.htmlTemplateParser = dependencies.htmlTemplateParser || window.SillyTavernInfobar?.modules?.htmlTemplateParser;
        this.customTemplates = new Map(); // 自定义模板缓存
        this.templateSettings = {
            enabled: false,
            defaultTemplate: null,
            templates: {}
        };

        // 🎨 字段标签映射
        this.FIELD_LABELS = {
            // 个人信息
            'name': '姓名', 'age': '年龄', 'gender': '性别', 'occupation': '职业',
            'personality': '性格', 'appearance': '外貌', 'background': '背景',
            'relationship': '关系', 'status': '状态', 'location': '位置',

            // 交互对象
            'attitude': '态度', 'emotion': '情绪', 'favorability': '好感度',
            'mood': '情绪状态', 'activity': '当前活动', 'availability': '可用性', 
            'priority': '优先级', 'trust': '信任度', 'intimacy': '亲密度',

            // 世界信息
            'world_name': '世界名称', 'world_type': '世界类型', 'time_period': '时代',
            'geography': '地理', 'climate': '气候', 'culture': '文化',
            'politics': '政治', 'economy': '经济', 'technology': '科技',
            'time': '时间', 'position': '位置', 'weather': '天气', 'environment': '环境',

            // 任务信息
            'task_name': '任务名称', 'task_type': '任务类型', 'task_status': '任务状态',
            'task_description': '任务描述', 'task_reward': '任务奖励',
            'task_deadline': '任务期限', 'task_progress': '任务进度',
            'type': '类型', 'description': '描述', 'progress': '进度',

            // 物品信息 - 添加图片中缺失的字段
            'item_name': '物品名称', 'item_type': '物品类型', 'item_quality': '物品品质',
            'item_description': '物品描述', 'item_effect': '物品效果',
            'item_value': '物品价值', 'item_quantity': '物品数量',
            'storage': '物品存储', 'retrieval': '物品取出', 'organization': '物品整理',
            'weapons': '武器装备', 'armor': '防具装备', 'capacity': '容量管理',
            'accessories': '饰品配件', 'consumables': '消耗品', 'materials': '材料物品',
            'tools': '工具器械', 'books': '书籍文献', 'treasures': '珍宝收藏',
            'weight': '重量限制', 'stacking': '堆叠功能', 'expansion': '扩容升级',
            'compartments': '分隔管理', 'protection': '保护功能', 'durability': '耐久度',
            'repair': '修理维护', 'trading': '交易功能', 'selling': '出售功能',
            'buying': '购买功能', 'auction': '拍卖系统', 'gifting': '赠送功能',

            // 能力信息
            'skill_name': '技能名称', 'skill_level': '技能等级', 'skill_type': '技能类型',
            'skill_description': '技能描述', 'skill_effect': '技能效果',
            'attribute_name': '属性名称', 'attribute_value': '属性值',
            'strength': '力量属性', 'agility': '敏捷属性', 'constitution': '体质属性',
            'wisdom': '智慧属性', 'charisma': '魅力属性', 'luck': '幸运属性',
            'perception': '感知属性', 'swordsmanship': '剑术技能', 'archery': '射箭技能',
            'magic': '魔法技能', 'defense': '防御技能', 'martialArts': '武术技能',
            'stealth': '潜行技能', 'tactics': '战术技能', 'healing': '治疗技能',

            // 常用字段
            'mood': '心情', 'state': '状态', 'action': '行动', 'goal': '目标',
            'plan': '计划', 'thought': '想法', 'feeling': '感受', 'memory': '记忆',
            'health': '健康', 'energy': '精力', 'money': '金钱', 'experience': '经验',
            'level': '等级', 'rank': '等级', 'title': '称号', 'reputation': '声望',
            'influence': '影响力', 'power': '力量', 'intelligence': '智力',

            // 地点和环境
            'place': '地点', 'scene': '场景', 'area': '区域', 'region': '地区',
            'building': '建筑', 'room': '房间', 'floor': '楼层', 'address': '地址',
            'temperature': '温度', 'humidity': '湿度', 'lighting': '光线',
            'noise': '噪音', 'crowd': '人群', 'safety': '安全',

            // 时间相关
            'date': '日期', 'hour': '小时', 'minute': '分钟', 'season': '季节',
            'day': '日', 'month': '月', 'year': '年', 'era': '时代',
            'period': '时期', 'duration': '持续时间', 'deadline': '截止时间',

            // 社交关系
            'friend': '朋友', 'enemy': '敌人', 'ally': '盟友', 'rival': '对手',
            'family': '家人', 'colleague': '同事', 'mentor': '导师', 'student': '学生',
            'lover': '恋人', 'spouse': '配偶', 'parent': '父母', 'child': '孩子',

            // 世界设定相关
            'genre': '类型', 'theme': '主题', 'history': '历史', 'mythology': '神话',
            'lore': '传说', 'locations': '地点', 'activity': '活动', 'availability': '可用性',
            'priority': '优先级', 'intimacy': '亲密度', 'autoRecord': '自动记录',

            // 任务管理
            'creation': '创建', 'editing': '编辑', 'deletion': '删除', 'completion': '完成',
            'notifications': '通知', 'listView': '列表视图', 'sorting': '排序',
            'hierarchy': '层级', 'positions': '职位', 'members': '成员',

            // 新闻事件
            'breaking': '突发新闻', 'official': '官方公告',

            // 剧情相关
            'mainStory': '主线剧情', 'sideQuests': '支线任务', 'subplots': '子剧情',
            'exposition': '背景说明',

            // 修炼系统
            'qiRefining': '炼气期', 'foundation': '筑基期', 'goldenCore': '金丹期',
            'breathingTechnique': '呼吸法', 'spiritualPower': '灵力值',

            // 奇幻种族
            'human': '人类种族', 'elf': '精灵种族', 'dwarf': '矮人种族',
            'fireMagic': '火系魔法',

            // 现代生活
            'city': '城市环境', 'district': '区域设定', 'transport': '交通工具',
            'job': '职业工作', 'income': '收入水平', 'smartphone': '智能手机',
            'social': '社交媒体',

            // 历史背景
            'dynasty': '朝代背景', 'class': '社会阶层', 'education': '教育程度',
            'martial': '武艺修为', 'clothing': '服饰风格', 'profession': '职业身份',

            // 魔法系统
            'evocation': '塑能系', 'illusion': '幻术系', 'cantrip': '戏法法术',
            'mana': '法力值', 'spellbook': '法术书', 'fire': '火元素',

            // 训练系统
            'obedience': '服从训练', 'discipline': '纪律训练', 'service': '服务训练',
            'confidence': '自信训练', 'intensity': '强度设置', 'auto': '自动训练'
        };

        // 🚫 系统字段过滤列表（这些字段不应该显示给用户）
        this.SYSTEM_FIELDS = new Set([
            'lastUpdated', 'source', 'timestamp', 'metadata', 'version',
            'id', 'uuid', 'created', 'modified', 'deleted', 'hidden',
            'internal', 'system', 'debug', 'temp', 'cache'
        ]);

        console.log('[MessageInfoBarRenderer] 🔧 消息信息栏渲染器初始化');
        this.init();
    }

    /**
     * 初始化渲染器
     */
    async init() {
        try {
            // 验证依赖
            if (!this.unifiedDataCore) {
                throw new Error('统一数据核心未初始化');
            }

            if (!this.eventSystem) {
                throw new Error('事件系统未初始化');
            }

            // 🔧 新增：初始化时清理所有残留的错误UI元素
            this.cleanupErrorUI();

            // 绑定事件监听器
            this.bindEventListeners();

            // 加载当前主题
            await this.loadCurrentTheme();

            this.initialized = true;
            console.log('[MessageInfoBarRenderer] ✅ 消息信息栏渲染器初始化完成');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            // 监听消息接收事件
            this.eventSystem.on('message:received', (data) => {
                this.handleMessageReceived(data);
            });

            // 监听数据更新事件
            this.eventSystem.on('data:updated', (data) => {
                this.handleDataUpdated(data);
            });

            // 监听主题变化事件
            this.eventSystem.on('theme:changed', (themeData) => {
                this.handleThemeChanged(themeData);
            });

            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', (data) => {
                this.handleChatChanged(data);
            });

            // 监听信息栏渲染请求事件（数据核心主动触发）
            this.eventSystem.on('infobar:render:request', (data) => {
                this.handleRenderRequest(data);
            });

            // 监听消息删除事件
            this.eventSystem.on('message:deleted', (data) => {
                this.handleMessageDeleted(data);
            });

            console.log('[MessageInfoBarRenderer] 🔗 事件监听器绑定完成');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 绑定事件监听器失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            console.log('[MessageInfoBarRenderer] 📨 收到消息接收事件');

            // 检查是否为AI消息
            if (!data || data.is_user === true) {
                console.log('[MessageInfoBarRenderer] ℹ️ 跳过用户消息');
                return;
            }

            console.log('[MessageInfoBarRenderer] 🎯 检测到AI消息，准备渲染信息栏（基于数据核心）');

            // 检查是否为自定义API数据更新（通过消息内容包含infobar_data标签判断）
            const messageContent = data.mes || '';
            const isCustomAPIUpdate = messageContent.includes('<infobar_data>');

            if (isCustomAPIUpdate) {
                console.log('[MessageInfoBarRenderer] 🔄 检测到自定义API数据更新，清除渲染记录...');

                // 获取消息ID - 尝试多种方式
                let messageId = this.getMessageId(data);

                // 如果无法从data获取，尝试从最新消息获取
                if (!messageId) {
                    try {
                        const context = SillyTavern.getContext();
                        if (context && context.chat && context.chat.length > 0) {
                            const lastMessage = context.chat[context.chat.length - 1];
                            if (lastMessage && !lastMessage.is_user) {
                                messageId = this.getMessageId(lastMessage);
                            }
                        }
                    } catch (error) {
                        console.warn('[MessageInfoBarRenderer] ⚠️ 获取最新消息ID失败:', error);
                    }
                }

                if (messageId) {
                    // 清除该消息的渲染记录，强制重新渲染
                    if (this.renderedMessages.has(messageId)) {
                        this.renderedMessages.delete(messageId);
                        console.log('[MessageInfoBarRenderer] 🧹 已清除消息', messageId, '的渲染记录');
                    } else {
                        console.log('[MessageInfoBarRenderer] ℹ️ 消息', messageId, '不在渲染记录中，无需清除');
                    }
                } else {
                    console.warn('[MessageInfoBarRenderer] ⚠️ 无法获取消息ID，尝试清除所有渲染记录');
                    // 作为备选方案，清除所有渲染记录
                    const clearedCount = this.renderedMessages.size;
                    this.renderedMessages.clear();
                    console.log('[MessageInfoBarRenderer] 🧹 已清除所有渲染记录，共', clearedCount, '条');
                }

                // 🚨 自定义API数据更新时，立即渲染信息栏
                console.log('[MessageInfoBarRenderer] 🚀 自定义API数据更新完成，立即开始渲染');
                this.renderInfoBarForLatestMessage();
                return;
            }

            // 🚨 新增：检查是否为自定义API模式
            const isCustomAPIMode = await this.isCustomAPIMode();
            if (isCustomAPIMode) {
                console.log('[MessageInfoBarRenderer] 🔄 检测到自定义API模式，主API返回后等待自定义API响应');
                console.log('[MessageInfoBarRenderer] ⏳ 跳过基于旧数据的信息栏渲染，等待自定义API更新数据');
                return;
            }

            // 🔧 修复：只有在非自定义API模式下，才基于数据核心立即渲染
            console.log('[MessageInfoBarRenderer] 🚀 主API模式，数据已准备就绪，立即开始渲染');
            this.renderInfoBarForLatestMessage();

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理消息接收事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 为最新的AI消息渲染信息栏
     */
    async renderInfoBarForLatestMessage() {
        try {
            // 检查是否为前端显示模式
            const isFrontendDisplayEnabled = await this.isFrontendDisplayEnabled();
            if (isFrontendDisplayEnabled) {
                console.log('[MessageInfoBarRenderer] 🖥️ 前端显示模式已启用，跳过最新消息渲染');
                return;
            }

            // 查找最新的AI消息
            const messages = document.querySelectorAll('.mes[is_user="false"]');
            if (messages.length === 0) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 未找到AI消息');
                return;
            }

            const latestMessage = messages[messages.length - 1];
            const messageId = latestMessage.getAttribute('mesid');

            if (!messageId) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 无法获取最新消息ID');
                return;
            }

            console.log('[MessageInfoBarRenderer] 🔍 检查消息ID:', messageId);

            // 🔧 修复：增强数据准备检查，确保数据真正可用
            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) {
        console.warn('[MessageInfoBarRenderer] ⚠️ 无法获取当前聊天ID');
                return;
            }

            const chatData = await this.unifiedDataCore.getChatData(currentChatId);
            if (!chatData || !chatData.infobar_data || !chatData.infobar_data.panels) {
        console.info('[MessageInfoBarRenderer] ℹ️ 当前聊天没有infobar_data，可能数据尚未准备好');

                // 🔧 新增：检查消息内容是否包含infobar_data标签
                const messageElement = document.querySelector(`[mesid="${messageId}"]`);
                if (messageElement) {
                    const messageText = messageElement.querySelector('.mes_text')?.textContent || '';
                    if (messageText.includes('<infobar_data>')) {
                        console.log('[MessageInfoBarRenderer] ⚠️ 消息包含infobar_data但数据核心中无数据，可能存在时序问题');
                        // 短暂延迟后重试一次
                        setTimeout(() => {
                            this.renderInfoBarForLatestMessage();
                        }, 500);
                        return;
                    }
                }

                console.log('[MessageInfoBarRenderer] ℹ️ 消息确实不包含infobar_data，跳过渲染');
                return;
            }

            console.log('[MessageInfoBarRenderer] ✅ 数据核心中找到有效的infobar_data，数据面板数量:', Object.keys(chatData.infobar_data.panels).length);

            console.log('[MessageInfoBarRenderer] 🎯 为消息ID渲染信息栏:', messageId);
            await this.renderInfoBarForMessage(messageId);

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染最新消息信息栏失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理数据更新事件
     */
    async handleDataUpdated(data) {
        try {
            console.log('[MessageInfoBarRenderer] 📊 收到数据更新事件');

            // 检查是否为前端显示模式
            const isFrontendDisplayEnabled = await this.isFrontendDisplayEnabled();
            if (isFrontendDisplayEnabled) {
                console.log('[MessageInfoBarRenderer] 🖥️ 前端显示模式已启用，跳过数据更新渲染');
                return;
            }

            // 获取当前聊天的最新消息ID
            const context = SillyTavern.getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return;
            }

            const lastMessage = context.chat[context.chat.length - 1];
            if (lastMessage && !lastMessage.is_user) {
                const messageId = this.getMessageId(lastMessage);
                if (messageId) {
                    // 延迟渲染
                    setTimeout(() => {
                        this.renderInfoBarForMessage(messageId);
                    }, 300);
                }
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理数据更新事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理主题变化事件
     */
    handleThemeChanged(themeData) {
        try {
            console.log('[MessageInfoBarRenderer] 🎨 收到主题变化事件:', themeData);

            this.currentTheme = themeData;

            // 更新所有已渲染的信息栏主题
            this.updateAllInfoBarThemes();

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理主题变化事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理信息栏渲染请求事件（数据核心主动触发）
     */
    async handleRenderRequest(data) {
        try {
            console.log('[MessageInfoBarRenderer] 🎯 收到信息栏渲染请求:', data.source);

            // 检查是否为前端显示模式
            const isFrontendDisplayEnabled = await this.isFrontendDisplayEnabled();
            if (isFrontendDisplayEnabled) {
                console.log('[MessageInfoBarRenderer] 🖥️ 前端显示模式已启用，跳过渲染请求');
                return;
            }

            if (data.messageId) {
                // 渲染指定消息的信息栏
                await this.renderInfoBarForMessage(data.messageId);
            } else {
                // 渲染最新消息的信息栏
                await this.renderInfoBarForLatestMessage();
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理渲染请求失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    handleChatChanged(data) {
        try {
            console.log('[MessageInfoBarRenderer] 🔄 收到聊天切换事件');

            // 清空已渲染消息记录
            this.renderedMessages.clear();

            // 清理所有信息栏元素
            this.cleanupAllInfoBars();

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理聊天切换事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理消息删除事件
     */
    handleMessageDeleted(data) {
        try {
            console.log('[MessageInfoBarRenderer] 🗑️ 收到消息删除事件:', data);

            // 获取消息ID
            let messageId = null;
            if (data && typeof data === 'object') {
                messageId = data.mesid || data.messageId || data.id || data.index?.toString();
            }

            if (!messageId) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 无法从删除事件中获取消息ID');
                return;
            }

            console.log('[MessageInfoBarRenderer] 🎯 清理被删除消息的信息栏:', messageId);

            // 清理该消息的信息栏元素
            this.cleanupInfoBarForMessage(messageId);

            // 从已渲染记录中移除
            if (this.renderedMessages.has(messageId)) {
                this.renderedMessages.delete(messageId);
                console.log('[MessageInfoBarRenderer] 🧹 已从渲染记录中移除:', messageId);
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理消息删除事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 获取消息ID
     */
    getMessageId(messageData) {
        try {
            // 尝试多种方式获取消息ID
            let messageId = messageData.mesid ||
                           messageData.messageId ||
                           messageData.id ||
                           messageData.index?.toString() ||
                           messageData.swipeId?.toString() ||
                           null;

            // 🔧 新增：如果从messageData无法获取ID，尝试从DOM获取最新消息ID
            if (!messageId) {
                console.log('[MessageInfoBarRenderer] 🔍 从messageData无法获取ID，尝试从DOM获取最新消息ID...');
                try {
                    const messages = document.querySelectorAll('.mes[is_user="false"]');
                    if (messages.length > 0) {
                        const latestMessage = messages[messages.length - 1];
                        messageId = latestMessage.getAttribute('mesid');
                        if (messageId) {
                            console.log('[MessageInfoBarRenderer] ✅ 从DOM获取到最新消息ID:', messageId);
                        }
                    }
                } catch (domError) {
                    console.warn('[MessageInfoBarRenderer] ⚠️ 从DOM获取消息ID失败:', domError);
                }
            }

            // 🔧 新增：如果仍然无法获取，使用时间戳作为临时ID
            if (!messageId) {
                messageId = `temp_${Date.now()}`;
                console.log('[MessageInfoBarRenderer] 🆔 使用临时消息ID:', messageId);
            }

            return messageId;
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 获取消息ID失败:', error);
            // 返回临时ID而不是null，确保后续流程能继续
            return `error_${Date.now()}`;
        }
    }

    /**
     * 为指定消息渲染信息栏
     */
    async renderInfoBarForMessage(messageId) {
        try {
            console.log('[MessageInfoBarRenderer] 🎨 开始为消息渲染信息栏:', messageId);

            // 检查是否为前端显示模式
            const isFrontendDisplayEnabled = await this.isFrontendDisplayEnabled();
            if (isFrontendDisplayEnabled) {
                console.log('[MessageInfoBarRenderer] 🖥️ 前端显示模式已启用，跳过传统信息栏渲染');
                return;
            }

            // 检查信息栏是否启用
            const isEnabled = await this.isInfoBarEnabled();
            if (!isEnabled) {
                console.log('[MessageInfoBarRenderer] ℹ️ 信息栏未启用，跳过渲染');
                return;
            }

            // 🔧 修复：获取当前风格，只对浮动式进行重复渲染检查
            const currentStyle = await this.getCurrentStyle();

            // 只有浮动式风格才检查重复渲染（因为浮动式是全局唯一的）
            if (currentStyle.id === 'floating' && this.renderedMessages.has(messageId)) {
                console.log('[MessageInfoBarRenderer] ℹ️ 浮动式消息已渲染过，跳过');
                return;
            }

            // 其他风格允许重复渲染（每次AI消息都创建新的信息栏）
            if (currentStyle.id !== 'floating' && this.renderedMessages.has(messageId)) {
                console.log('[MessageInfoBarRenderer] 🔄 非浮动式风格，清理旧信息栏并重新渲染');
                // 清理旧的信息栏
                this.cleanupInfoBarForMessage(messageId);
                this.renderedMessages.delete(messageId);
            }

            // 获取当前聊天数据
            let infobarData;
            try {
                console.log('[MessageInfoBarRenderer] 🔍 开始获取数据...');

                // 获取当前聊天ID
                const currentChatId = this.unifiedDataCore.getCurrentChatId();
                console.log('[MessageInfoBarRenderer] 🔍 当前聊天ID:', currentChatId);

                if (!currentChatId) {
                    console.warn('[MessageInfoBarRenderer] ⚠️ 无法获取当前聊天ID');
                    return;
                }

                // 获取聊天数据
                const chatData = await this.unifiedDataCore.getChatData(currentChatId);
                console.log('[MessageInfoBarRenderer] 🔍 获取到的聊天数据:', chatData);

                // 提取infobar_data
                infobarData = chatData?.infobar_data || {};
                console.log('[MessageInfoBarRenderer] 🔍 提取的infobar_data:', infobarData);
                console.log('[MessageInfoBarRenderer] 🔍 数据类型:', typeof infobarData);
                console.log('[MessageInfoBarRenderer] 🔍 是否有panels:', !!infobarData?.panels);
                if (infobarData?.panels) {
                    console.log('[MessageInfoBarRenderer] 🔍 panels内容:', Object.keys(infobarData.panels));
                }
            } catch (error) {
                console.error('[MessageInfoBarRenderer] ❌ 获取数据失败:', error);
                return;
            }

            if (!infobarData || !infobarData.panels) {
                console.log('[MessageInfoBarRenderer] ℹ️ 没有可渲染的数据');
                console.log('[MessageInfoBarRenderer] ℹ️ infobarData:', infobarData);
                return;
            }

            // 生成信息栏HTML
            const infoBarHtml = await this.generateInfoBarHtml(infobarData, messageId);
            if (!infoBarHtml) {
                console.log('[MessageInfoBarRenderer] ℹ️ 没有生成有效的信息栏HTML');
                return;
            }

            // 使用之前获取的风格配置（避免重复声明）

            // 插入信息栏到消息中
            const success = this.insertInfoBarToMessage(messageId, infoBarHtml, currentStyle);
            if (success) {
                this.renderedMessages.add(messageId);

                // 初始化交互功能（如果需要）
                if (['floating', 'interactive'].includes(currentStyle.id)) {
                    this.initializeInteractiveFeatures();
                }

                console.log('[MessageInfoBarRenderer] ✅ 信息栏渲染完成:', messageId);
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染信息栏失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[MessageInfoBarRenderer] ❌ 错误计数:', this.errorCount);
        
        // 如果错误过多，可以考虑禁用渲染器
        if (this.errorCount > 10) {
            console.error('[MessageInfoBarRenderer] ❌ 错误过多，考虑重新初始化');
        }
    }

    /**
     * 🔧 新增：清理所有错误UI元素
     * 用于在初始化、禁用插件或切换聊天时清理残留的错误提示
     */
    cleanupErrorUI() {
        try {
            // 查找并移除所有 infobar-error 和 infobar-empty 类的元素
            const errorElements = document.querySelectorAll('.infobar-error, .infobar-empty');
            if (errorElements.length > 0) {
                console.log(`[MessageInfoBarRenderer] 🧹 开始清理 ${errorElements.length} 个错误UI元素`);
                errorElements.forEach(element => {
                    element.remove();
                });
                console.log('[MessageInfoBarRenderer] ✅ 错误UI清理完成');
            } else {
                console.log('[MessageInfoBarRenderer] ℹ️ 没有发现错误UI元素需要清理');
            }
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 清理错误UI失败:', error);
        }
    }

    /**
     * 生成信息栏HTML
     */
    async generateInfoBarHtml(infobarData, messageId) {
        try {
            if (!infobarData || !infobarData.panels) {
                return '';
            }

            // 获取启用的面板配置
            const enabledPanels = this.getEnabledPanels();
            console.log('[MessageInfoBarRenderer] 🔍 启用的面板:', enabledPanels);
            if (!enabledPanels || Object.keys(enabledPanels).length === 0) {
                console.log('[MessageInfoBarRenderer] ℹ️ 没有启用的面板');
                return '';
            }

            // 检查是否有有效的面板数据
            const hasValidData = this.hasValidPanelData(infobarData.panels, enabledPanels);
            console.log('[MessageInfoBarRenderer] 🔍 是否有有效数据:', hasValidData);
            if (!hasValidData) {
                console.log('[MessageInfoBarRenderer] ℹ️ 没有有效的面板数据');
                return '';
            }

            // 获取当前风格配置
            const currentStyle = await this.getCurrentStyle();
            console.log('[MessageInfoBarRenderer] 🎭 当前风格:', currentStyle);

            // 根据风格生成HTML
            return await this.generateStyleBasedHtml(infobarData, messageId, enabledPanels, currentStyle);

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成信息栏HTML失败:', error);
            return '';
        }
    }

    /**
     * 根据风格生成HTML
     */
    async generateStyleBasedHtml(infobarData, messageId, enabledPanels, style) {
        try {
            // 获取默认折叠状态
            const defaultCollapsed = await this.isDefaultCollapsed();

            // 加载当前主题
            await this.loadCurrentTheme();

            // 根据风格选择渲染方法
            switch (style.id) {
                case 'end-generated':
                    return await this.generateEndGeneratedStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
                case 'flat':
                    return await this.generateFlatStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
                case 'conversation-wrapped':
                    return await this.generateWrappedStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
                case 'floating':
                    return await this.generateFloatingStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
                case 'embedded':
                    return await this.generateEmbeddedStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
                case 'interactive':
                    return await this.generateInteractiveStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
                case 'custom-html':
                    return await this.generateCustomHTMLStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
                default:
                    // 默认使用结尾生成式
                    return await this.generateEndGeneratedStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 根据风格生成HTML失败:', error);
            return '';
        }
    }

    /**
     * 获取当前风格配置
     */
    async getCurrentStyle() {
        try {
            // 直接从 SillyTavern 的 extensionSettings 读取风格配置
            const context = SillyTavern?.getContext?.();
            if (context && context.extensionSettings) {
                const extensionSettings = context.extensionSettings;
                const toolSettings = extensionSettings['Information bar integration tool'];

                if (toolSettings && toolSettings.style && toolSettings.style.current) {
                    const styleId = toolSettings.style.current;
                    console.log('[MessageInfoBarRenderer] 🎭 从extensionSettings读取风格:', styleId);

                    // 获取风格详细配置
                    const styles = this.getAllStyles();
                    const selectedStyle = styles.find(s => s.id === styleId);
                    if (selectedStyle) {
                        console.log('[MessageInfoBarRenderer] ✅ 找到风格配置:', selectedStyle.name);
                        return selectedStyle;
                    }
                }
            }

            // 备用方案：从配置管理器获取当前风格
            if (this.configManager) {
                const styleConfig = await this.configManager.getConfig('style');
                if (styleConfig && styleConfig.current) {
                    // 获取风格详细配置
                    const styleId = styleConfig.current;
                    const styles = this.getAllStyles();
                    return styles.find(s => s.id === styleId) || styles[0];
                }
            }

            // 默认返回结尾生成式
            console.log('[MessageInfoBarRenderer] ⚠️ 使用默认风格: 结尾生成式');
            return {
                id: 'end-generated',
                name: '结尾生成式',
                config: {
                    position: 'end',
                    layout: 'bottom',
                    integration: 'separate'
                }
            };

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 获取当前风格失败:', error);
            return { id: 'end-generated', name: '结尾生成式', config: { position: 'end' } };
        }
    }

    /**
     * 刷新所有已渲染的信息栏（用于风格切换）
     */
    async refreshAllInfoBars() {
        try {
            console.log('[MessageInfoBarRenderer] 🔄 开始刷新所有信息栏');

            // 检查是否为前端显示模式
            const isFrontendDisplayEnabled = await this.isFrontendDisplayEnabled();
            if (isFrontendDisplayEnabled) {
                console.log('[MessageInfoBarRenderer] 🖥️ 前端显示模式已启用，跳过信息栏刷新');
                return;
            }

            // 获取所有已渲染的消息
            const renderedMessageIds = Array.from(this.renderedMessages);
            console.log('[MessageInfoBarRenderer] 📊 需要刷新的信息栏数量:', renderedMessageIds.length);

            // 清除已渲染记录，强制重新渲染
            this.renderedMessages.clear();

            // 重新渲染每个信息栏
            for (const messageId of renderedMessageIds) {
                try {
                    await this.renderInfoBarForMessage(messageId);
                } catch (error) {
                    console.error('[MessageInfoBarRenderer] ❌ 刷新信息栏失败:', messageId, error);
                }
            }

            console.log('[MessageInfoBarRenderer] ✅ 所有信息栏刷新完成');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 刷新所有信息栏失败:', error);
        }
    }

    /**
     * 获取所有风格配置
     */
    getAllStyles() {
        return [
            {
                id: 'custom-html',
                name: '自定义HTML模板',
                description: '使用自定义HTML模板渲染信息栏',
                icon: 'fa-solid fa-code',
                preview: 'custom-html-preview.png'
            },
            {
                id: 'end-generated',
                name: '结尾生成式',
                config: { position: 'end', layout: 'bottom', integration: 'separate' }
            },
            {
                id: 'flat',
                name: '扁平式',
                config: { position: 'end', layout: 'flat', integration: 'separate' }
            },
            {
                id: 'conversation-wrapped',
                name: '对话包裹式',
                config: { position: 'wrapper', layout: 'frame', integration: 'integrated' }
            },
            {
                id: 'floating',
                name: '浮动式',
                config: { position: 'overlay', layout: 'floating', integration: 'independent' }
            },
            {
                id: 'embedded',
                name: '内嵌式',
                config: { position: 'inline', layout: 'embedded', integration: 'merged' }
            },
            {
                id: 'interactive',
                name: '前端交互式',
                config: { position: 'overlay', layout: 'interactive', integration: 'advanced' }
            }
        ];
    }

    /**
     * 生成结尾生成式风格HTML（原有风格）
     */
    async generateEndGeneratedStyle(infobarData, messageId, enabledPanels, defaultCollapsed) {
        try {
            // 创建信息栏容器，应用主题样式
            let html = `<div class="infobar-container infobar-style-end-generated" data-message-id="${messageId}"`;
            if (this.currentTheme && this.currentTheme.colors) {
                const colors = this.currentTheme.colors;
                html += ` style="--infobar-bg: ${colors.bg}; --infobar-text: ${colors.text}; --infobar-primary: ${colors.primary}; --infobar-border: ${colors.border};"`;
            }
            html += `>`;
            html += `<div class="infobar-panels">`;

            // 标准面板渲染顺序
            const standardPanelOrder = [
                'personal', 'world', 'interaction', 'inventory', 'abilities',
                'tasks', 'organization', 'news', 'plot', 'cultivation',
                'fantasy', 'modern', 'historical', 'magic', 'training'
            ];

            // 渲染标准面板
            for (const panelKey of standardPanelOrder) {
                if (enabledPanels[panelKey] && infobarData.panels[panelKey]) {
                    const panelHtml = this.renderPanel(panelKey, infobarData.panels[panelKey], enabledPanels[panelKey], defaultCollapsed);
                    if (panelHtml) {
                        html += panelHtml;
                    }
                }
            }

            // 渲染自定义面板
            const customPanels = this.getCustomPanels(infobarData.panels, enabledPanels);
            for (const [panelId, panelData] of customPanels) {
                const panelHtml = this.renderCustomPanel(panelId, panelData, enabledPanels[panelId], defaultCollapsed);
                if (panelHtml) {
                    html += panelHtml;
                }
            }

            html += `</div></div>`;
            return html;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成结尾生成式风格失败:', error);
            return '';
        }
    }

    /**
     * 生成扁平式风格HTML（不额外包裹整体，仅改变面板为扁平UI）
     */
    async generateFlatStyle(infobarData, messageId, enabledPanels, defaultCollapsed) {
        try {
            const panelsHtml = await this.generatePanelsContent(infobarData, enabledPanels, defaultCollapsed);

            // 仅输出容器 + 面板，具体扁平视觉通过CSS作用于各面板
            return `
                <div class="infobar-container infobar-style-flat" data-message-id="${messageId}" ${this.getThemeStyles()}>
                    <div class="infobar-panels">
                        ${panelsHtml}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成扁平式风格失败:', error);
            return '';
        }
    }

    /**
     * 生成对话包裹式风格HTML
     */
    async generateWrappedStyle(infobarData, messageId, enabledPanels, defaultCollapsed) {
        try {
            const panelsHtml = await this.generatePanelsContent(infobarData, enabledPanels, defaultCollapsed);

            return `
                <div class="infobar-container infobar-style-wrapped" data-message-id="${messageId}" ${this.getThemeStyles()}>
                    <div class="infobar-wrapper">
                        <div class="infobar-header">
                            <div class="wrapper-title">📋 信息面板</div>
                            <div class="wrapper-controls">
                                <button class="wrapper-toggle" onclick="this.closest('.infobar-wrapper').classList.toggle('collapsed')">
                                    <span class="toggle-icon">▼</span>
                                </button>
                            </div>
                        </div>
                        <div class="infobar-content">
                            <div class="infobar-panels">
                                ${panelsHtml}
                            </div>
                        </div>
                        <div class="infobar-footer">
                            <div class="wrapper-status">信息已更新</div>
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成对话包裹式风格失败:', error);
            return '';
        }
    }

    /**
     * 生成浮动式风格HTML（带交互小球）
     */
    async generateFloatingStyle(infobarData, messageId, enabledPanels, defaultCollapsed) {
        try {
            const panelsHtml = await this.generatePanelsContent(infobarData, enabledPanels, defaultCollapsed);

            return `
                <div class="infobar-container infobar-style-floating" data-message-id="${messageId}" ${this.getThemeStyles()}>
                    <!-- 交互小球 -->
                    <div class="floating-orb" data-draggable="true" data-drag-handle="true" title="点击展开信息栏">
                        <div class="orb-icon">
                            <span class="orb-emoji">🎈</span>
                            <div class="orb-pulse"></div>
                        </div>
                        <div class="orb-tooltip">信息栏</div>
                    </div>

                    <!-- 信息栏窗口（默认隐藏） -->
                    <div class="infobar-floating-window" data-draggable="true" style="display: none;">
                        <div class="floating-header" data-drag-handle="true">
                            <div class="floating-title">🎈 信息面板</div>
                            <div class="floating-controls">
                                <button class="floating-minimize" onclick="this.closest('.infobar-floating-window').style.display='none'; this.closest('.infobar-container').querySelector('.floating-orb').style.display='block';" title="最小化到小球">
                                    <span class="minimize-icon">−</span>
                                </button>
                            </div>
                        </div>
                        <div class="floating-content">
                            <div class="infobar-panels">
                                ${panelsHtml}
                            </div>
                        </div>
                        <div class="floating-resize-handle"></div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成浮动式风格失败:', error);
            return '';
        }
    }

    /**
     * 生成内嵌式风格HTML
     */
    async generateEmbeddedStyle(infobarData, messageId, enabledPanels, defaultCollapsed) {
        try {
            const panelsHtml = await this.generatePanelsContent(infobarData, enabledPanels, defaultCollapsed);

            return `
                <div class="infobar-container infobar-style-embedded" data-message-id="${messageId}" ${this.getThemeStyles()}>
                    <div class="infobar-embedded">
                        <div class="embedded-separator">
                            <span class="separator-line"></span>
                            <span class="separator-text">📊 角色信息</span>
                            <span class="separator-line"></span>
                        </div>
                        <div class="infobar-panels embedded-panels">
                            ${panelsHtml}
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成内嵌式风格失败:', error);
            return '';
        }
    }

    /**
     * 生成前端交互式风格HTML
     */
    async generateInteractiveStyle(infobarData, messageId, enabledPanels, defaultCollapsed) {
        try {
            const panelsHtml = await this.generatePanelsContent(infobarData, enabledPanels, defaultCollapsed);

            // 生成标签页
            const tabsHtml = this.generateInteractiveTabs(enabledPanels);
            const tabContentHtml = await this.generateInteractiveTabContent(infobarData, enabledPanels, defaultCollapsed);

            return `
                <div class="infobar-container infobar-style-interactive" data-message-id="${messageId}" ${this.getThemeStyles()}>
                    <div class="infobar-interactive-window" data-draggable="true" data-resizable="true">
                        <div class="interactive-header" data-drag-handle="true">
                            <div class="interactive-title">🎛️ 交互式信息面板</div>
                            <div class="interactive-controls">
                                <button class="interactive-refresh" onclick="this.refreshInfoBar('${messageId}')">
                                    <span class="refresh-icon">🔄</span>
                                </button>
                                <button class="interactive-settings" onclick="this.openInfoBarSettings()">
                                    <span class="settings-icon">⚙️</span>
                                </button>
                                <button class="interactive-minimize" onclick="this.closest('.infobar-interactive-window').classList.toggle('minimized')">
                                    <span class="minimize-icon">−</span>
                                </button>
                                <button class="interactive-close" onclick="this.closest('.infobar-container').style.display='none'">
                                    <span class="close-icon">×</span>
                                </button>
                            </div>
                        </div>
                        <div class="interactive-tabs">
                            ${tabsHtml}
                        </div>
                        <div class="interactive-content">
                            ${tabContentHtml}
                        </div>
                        <div class="interactive-footer">
                            <div class="footer-actions">
                                <button class="action-btn export-btn" onclick="this.exportInfoBarData('${messageId}')">
                                    📤 导出数据
                                </button>
                                <button class="action-btn edit-btn" onclick="this.editInfoBarData('${messageId}')">
                                    ✏️ 编辑信息
                                </button>
                                <button class="action-btn save-btn" onclick="this.saveInfoBarData('${messageId}')">
                                    💾 保存更改
                                </button>
                            </div>
                            <div class="footer-status">
                                <span class="status-text">就绪</span>
                                <span class="last-updated">最后更新: ${new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>
                        <div class="interactive-resize-handles">
                            <div class="resize-handle resize-n"></div>
                            <div class="resize-handle resize-s"></div>
                            <div class="resize-handle resize-e"></div>
                            <div class="resize-handle resize-w"></div>
                            <div class="resize-handle resize-ne"></div>
                            <div class="resize-handle resize-nw"></div>
                            <div class="resize-handle resize-se"></div>
                            <div class="resize-handle resize-sw"></div>
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成前端交互式风格失败:', error);
            return '';
        }
    }

    /**
     * 生成自定义HTML模板风格
     */
    async generateCustomHTMLStyle(infobarData, messageId, enabledPanels, defaultCollapsed) {
        try {
            console.log('[MessageInfoBarRenderer] 🎨 生成自定义HTML模板风格...');

            // 获取自定义模板
            const customTemplate = await this.getCustomTemplate();

            if (!customTemplate) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 未找到自定义模板，使用默认模板');
                return await this.generateEndGeneratedStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
            }

            // 准备模板数据
            const templateData = this.prepareTemplateData(infobarData, enabledPanels);

            // 使用HTML模板解析器渲染
            let renderedHTML = '';
            if (this.htmlTemplateParser) {
                renderedHTML = this.htmlTemplateParser.parseTemplate(customTemplate, templateData);
            } else {
                console.warn('[MessageInfoBarRenderer] ⚠️ HTML模板解析器未初始化，使用简单渲染');
                renderedHTML = this.simpleTemplateRender(customTemplate, templateData);
            }

            // 🔧 修复：包装在容器中，不强制应用SillyTavern主题样式
            // 自定义HTML应该使用自己的CSS样式，而不是被SillyTavern主题覆盖
            return `
                <div class="infobar-container infobar-style-custom-html" data-message-id="${messageId}">
                    <div class="custom-html-wrapper">
                        ${renderedHTML}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成自定义HTML模板风格失败:', error);
            // 回退到默认风格
            return await this.generateEndGeneratedStyle(infobarData, messageId, enabledPanels, defaultCollapsed);
        }
    }

    /**
     * 获取自定义模板
     */
    async getCustomTemplate() {
        try {
            console.log('[MessageInfoBarRenderer] 📂 获取自定义模板...');

            // 首先从SillyTavern扩展设置中获取保存的自定义HTML模板
            const context = SillyTavern.getContext();
            const extensionSettings = context?.extensionSettings || {};
            const configs = extensionSettings['Information bar integration tool'] || {};
            const customHTMLTemplate = configs.customHTMLTemplate;

            if (customHTMLTemplate && customHTMLTemplate.trim()) {
                console.log('[MessageInfoBarRenderer] ✅ 找到保存的自定义HTML模板');

                // 🔧 验证模板完整性
                const templateLength = customHTMLTemplate.length;
                const hasStyleTag = customHTMLTemplate.includes('<style>');
                const hasBodyTag = customHTMLTemplate.includes('<body>');
                const hasDoctype = customHTMLTemplate.includes('<!DOCTYPE');

                console.log('[MessageInfoBarRenderer] 🔍 模板完整性检查:', {
                    长度: templateLength,
                    包含样式: hasStyleTag,
                    包含主体: hasBodyTag,
                    包含文档类型: hasDoctype
                });

                if (templateLength < 1000 || !hasStyleTag || !hasBodyTag) {
                    console.warn('[MessageInfoBarRenderer] ⚠️ 模板可能不完整，但仍尝试使用');
                }

                return customHTMLTemplate;
            }

            console.log('[MessageInfoBarRenderer] 📝 未找到自定义HTML模板，尝试其他来源...');

            // 从配置中获取当前使用的模板
            const templateSettings = await this.getTemplateSettings();

            if (templateSettings.enabled && templateSettings.defaultTemplate) {
                console.log('[MessageInfoBarRenderer] ✅ 使用模板设置中的默认模板');
                return templateSettings.defaultTemplate;
            }

            // 从模板管理器获取默认模板
            const infoBarTool = window.SillyTavernInfobar?.modules?.infoBarTool;
            if (infoBarTool && infoBarTool.templateManager) {
                const defaultTemplate = infoBarTool.templateManager.getTemplate('character-card');
                if (defaultTemplate) {
                    console.log('[MessageInfoBarRenderer] ✅ 使用模板管理器中的默认模板');
                    return defaultTemplate.template;
                }
            }

            // 如果没有设置，返回一个基本模板
            console.log('[MessageInfoBarRenderer] 📝 使用内置默认模板');
            return this.getDefaultCustomTemplate();

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 获取自定义模板失败:', error);
            return this.getDefaultCustomTemplate();
        }
    }

    /**
     * 获取模板设置
     */
    async getTemplateSettings() {
        try {
            // 从SillyTavern扩展设置中读取
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            return configs.htmlTemplateSettings || this.templateSettings;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 获取模板设置失败:', error);
            return this.templateSettings;
        }
    }

    /**
     * 获取默认自定义模板
     */
    getDefaultCustomTemplate() {
        return `
            <div class="character-status-card" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                padding: 20px;
                color: white;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                margin: 10px 0;
            ">
                <div class="character-header" style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                ">
                    <div class="character-avatar" style="
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        background: rgba(255, 255, 255, 0.2);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 15px;
                        font-size: 20px;
                    ">
                        👤
                    </div>
                    <div class="character-info">
                        <h3 style="margin: 0; font-size: 18px;">{{data.name}}</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;">
                            {{data.class}} - Lv.{{data.level}}
                        </p>
                    </div>
                </div>

                {{#if data.health}}
                <div class="health-bar" style="margin: 10px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px;">
                        <span>生命值</span>
                        <span>{{data.health}}/{{data.maxHealth}}</span>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="
                            background: #4CAF50;
                            height: 100%;
                            width: {{computed.healthPercentage}}%;
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                </div>
                {{/if}}

                {{#if data.energy}}
                <div class="energy-bar" style="margin: 10px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px;">
                        <span>能量值</span>
                        <span>{{data.energy}}/{{data.maxEnergy}}</span>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="
                            background: #2196F3;
                            height: 100%;
                            width: {{computed.energyPercentage}}%;
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                </div>
                {{/if}}

                <div class="character-details" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 10px;
                    margin-top: 15px;
                    font-size: 13px;
                ">
                    {{#if data.location}}
                    <div style="text-align: center;">
                        <div style="opacity: 0.8;">位置</div>
                        <div style="font-weight: bold;">{{data.location}}</div>
                    </div>
                    {{/if}}

                    {{#if data.mood}}
                    <div style="text-align: center;">
                        <div style="opacity: 0.8;">心情</div>
                        <div style="font-weight: bold;">{{data.mood}}</div>
                    </div>
                    {{/if}}

                    {{#if data.time}}
                    <div style="text-align: center;">
                        <div style="opacity: 0.8;">时间</div>
                        <div style="font-weight: bold;">{{data.time}}</div>
                    </div>
                    {{/if}}
                </div>
            </div>
        `;
    }

    /**
     * 准备模板数据
     */
    prepareTemplateData(infobarData, enabledPanels) {
        try {
            // 保持嵌套数据结构，支持 {{data.character.name}} 这样的模板语法
            const nestedData = {};

            // 扁平化数据结构，便于向后兼容
            const flatData = {};

            if (infobarData && infobarData.panels) {
                Object.entries(infobarData.panels).forEach(([panelId, panelData]) => {
                    if (enabledPanels[panelId] && panelData) {
                        // 保持嵌套结构
                        nestedData[panelId] = panelData;

                        // 同时创建扁平结构用于向后兼容
                        Object.entries(panelData).forEach(([key, value]) => {
                            flatData[key] = value;
                        });
                    }
                });
            }

            // 计算字段
            const computed = {
                healthPercentage: flatData.health && flatData.maxHealth ?
                    Math.round((flatData.health / flatData.maxHealth) * 100) : 0,
                energyPercentage: flatData.energy && flatData.maxEnergy ?
                    Math.round((flatData.energy / flatData.maxEnergy) * 100) : 0,
                timestamp: new Date().toLocaleString()
            };

            return {
                // 使用嵌套数据作为主要数据源，支持 {{data.character.name}} 语法
                data: nestedData,
                // 保留扁平数据用于向后兼容
                flatData,
                computed,
                panels: infobarData.panels || {},
                enabledPanels
            };

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 准备模板数据失败:', error);
            return { data: {}, computed: {}, panels: {}, enabledPanels: {} };
        }
    }

    /**
     * 简单模板渲染（备用方案）
     */
    simpleTemplateRender(template, data) {
        try {
            let result = template;

            // 简单的数据绑定替换
            result = result.replace(/\{\{data\.(\w+)\}\}/g, (match, field) => {
                return data.data[field] || '';
            });

            result = result.replace(/\{\{computed\.(\w+)\}\}/g, (match, field) => {
                return data.computed[field] || '';
            });

            // 简单的条件渲染处理
            result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
                // 简单的存在性检查
                const value = condition.startsWith('data.') ?
                    data.data[condition.substring(5)] :
                    data.computed[condition.substring(9)];
                return value ? content : '';
            });

            return result;
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 简单模板渲染失败:', error);
            return `<div style="color: red;">模板渲染错误: ${error.message}</div>`;
        }
    }

    /**
     * 生成面板内容（通用方法）
     */
    async generatePanelsContent(infobarData, enabledPanels, defaultCollapsed) {
        try {
            let html = '';

            // 标准面板渲染顺序
            const standardPanelOrder = [
                'personal', 'world', 'interaction', 'inventory', 'abilities',
                'tasks', 'organization', 'news', 'plot', 'cultivation',
                'fantasy', 'modern', 'historical', 'magic', 'training'
            ];

            // 渲染标准面板
            for (const panelKey of standardPanelOrder) {
                if (enabledPanels[panelKey] && infobarData.panels[panelKey]) {
                    const panelHtml = this.renderPanel(panelKey, infobarData.panels[panelKey], enabledPanels[panelKey], defaultCollapsed);
                    if (panelHtml) {
                        html += panelHtml;
                    }
                }
            }

            // 渲染自定义面板
            const customPanels = this.getCustomPanels(infobarData.panels, enabledPanels);
            for (const [panelId, panelData] of customPanels) {
                const panelHtml = this.renderCustomPanel(panelId, panelData, enabledPanels[panelId], defaultCollapsed);
                if (panelHtml) {
                    html += panelHtml;
                }
            }

            return html;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成面板内容失败:', error);
            return '';
        }
    }

    /**
     * 获取主题样式字符串
     */
    getThemeStyles() {
        if (this.currentTheme && this.currentTheme.colors) {
            const colors = this.currentTheme.colors;
            return `style="--infobar-bg: ${colors.bg}; --infobar-text: ${colors.text}; --infobar-primary: ${colors.primary}; --infobar-border: ${colors.border};"`;
        }
        return '';
    }

    /**
     * 生成交互式标签页
     */
    generateInteractiveTabs(enabledPanels) {
        const tabs = [];

        // 基础标签页
        if (enabledPanels.personal) tabs.push({ id: 'personal', name: '👤 个人', icon: '👤' });
        if (enabledPanels.world) tabs.push({ id: 'world', name: '🌍 世界', icon: '🌍' });
        if (enabledPanels.interaction) tabs.push({ id: 'interaction', name: '👥 交互', icon: '👥' });
        if (enabledPanels.tasks) tabs.push({ id: 'tasks', name: '📋 任务', icon: '📋' });
        if (enabledPanels.inventory) tabs.push({ id: 'inventory', name: '🎒 物品', icon: '🎒' });

        // 如果有其他启用的面板，添加"更多"标签页
        const otherPanels = Object.keys(enabledPanels).filter(key =>
            !['personal', 'world', 'interaction', 'tasks', 'inventory'].includes(key)
        );
        if (otherPanels.length > 0) {
            tabs.push({ id: 'more', name: '📚 更多', icon: '📚' });
        }

        return tabs.map((tab, index) => `
            <div class="interactive-tab ${index === 0 ? 'active' : ''}" data-tab="${tab.id}">
                <span class="tab-icon">${tab.icon}</span>
                <span class="tab-text">${tab.name}</span>
            </div>
        `).join('');
    }

    /**
     * 生成交互式标签页内容
     */
    async generateInteractiveTabContent(infobarData, enabledPanels, defaultCollapsed) {
        try {
            let html = '';

            // 个人信息标签页
            if (enabledPanels.personal) {
                html += `<div class="tab-content active" data-tab-content="personal">`;
                if (infobarData.panels.personal) {
                    html += this.renderPanel('personal', infobarData.panels.personal, enabledPanels.personal, false);
                }
                html += `</div>`;
            }

            // 世界信息标签页
            if (enabledPanels.world) {
                html += `<div class="tab-content" data-tab-content="world">`;
                if (infobarData.panels.world) {
                    html += this.renderPanel('world', infobarData.panels.world, enabledPanels.world, false);
                }
                html += `</div>`;
            }

            // 交互信息标签页
            if (enabledPanels.interaction) {
                html += `<div class="tab-content" data-tab-content="interaction">`;
                if (infobarData.panels.interaction) {
                    html += this.renderPanel('interaction', infobarData.panels.interaction, enabledPanels.interaction, false);
                }
                html += `</div>`;
            }

            // 任务信息标签页
            if (enabledPanels.tasks) {
                html += `<div class="tab-content" data-tab-content="tasks">`;
                if (infobarData.panels.tasks) {
                    html += this.renderPanel('tasks', infobarData.panels.tasks, enabledPanels.tasks, false);
                }
                html += `</div>`;
            }

            // 物品信息标签页
            if (enabledPanels.inventory) {
                html += `<div class="tab-content" data-tab-content="inventory">`;
                if (infobarData.panels.inventory) {
                    html += this.renderPanel('inventory', infobarData.panels.inventory, enabledPanels.inventory, false);
                }
                html += `</div>`;
            }

            // 更多标签页（包含其他所有面板）
            const otherPanels = Object.keys(enabledPanels).filter(key =>
                !['personal', 'world', 'interaction', 'tasks', 'inventory'].includes(key)
            );
            if (otherPanels.length > 0) {
                html += `<div class="tab-content" data-tab-content="more">`;
                for (const panelKey of otherPanels) {
                    if (infobarData.panels[panelKey]) {
                        html += this.renderPanel(panelKey, infobarData.panels[panelKey], enabledPanels[panelKey], false);
                    }
                }
                html += `</div>`;
            }

            return html;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成交互式标签页内容失败:', error);
            return '';
        }
    }

    /**
     * 初始化交互功能
     */
    initializeInteractiveFeatures() {
        try {
            if (this.interactiveInitialized) {
                console.log('[MessageInfoBarRenderer] ℹ️ 交互功能已初始化，跳过重复绑定');
                return;
            }

            // 初始化拖拽功能
            this.initializeDragging();

            // 初始化调整大小功能
            this.initializeResizing();

            // 初始化标签页切换
            this.initializeTabSwitching();

            // 初始化浮动小球交互
            this.initializeFloatingOrb();

            this.interactiveInitialized = true;
            console.log('[MessageInfoBarRenderer] ✅ 交互功能初始化完成');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 初始化交互功能失败:', error);
        }
    }

    /**
     * 初始化拖拽功能（支持桌面端和移动端）
     */
    initializeDragging() {
        // 🔧 统一处理函数：同时支持鼠标和触摸事件
        const handleDragStart = (e) => {
            const dragHandle = e.target.closest('[data-drag-handle="true"]');
            if (!dragHandle) return;

            const draggableWindow = dragHandle.closest('[data-draggable="true"]');
            if (!draggableWindow) return;

            e.preventDefault();

            // 🔧 获取初始坐标（兼容鼠标和触摸）
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

            const rect = draggableWindow.getBoundingClientRect();
            const offsetX = clientX - rect.left;
            const offsetY = clientY - rect.top;

            // 🔧 移动处理函数
            const handleMove = (e) => {
                // 🔧 获取当前坐标（兼容鼠标和触摸）
                const currentX = e.clientX || (e.touches && e.touches[0].clientX);
                const currentY = e.clientY || (e.touches && e.touches[0].clientY);

                const x = currentX - offsetX;
                const y = currentY - offsetY;

                // 限制在视窗内
                const maxX = window.innerWidth - draggableWindow.offsetWidth;
                const maxY = window.innerHeight - draggableWindow.offsetHeight;

                draggableWindow.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
                draggableWindow.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
                draggableWindow.style.right = 'auto';
                draggableWindow.style.bottom = 'auto';
            };

            // 🔧 结束处理函数
            const handleEnd = () => {
                // 移除鼠标事件监听器
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleEnd);
                // 移除触摸事件监听器
                document.removeEventListener('touchmove', handleMove);
                document.removeEventListener('touchend', handleEnd);
                document.removeEventListener('touchcancel', handleEnd);
                
                draggableWindow.style.cursor = 'move';
            };

            // 🔧 添加鼠标和触摸事件监听器
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchmove', handleMove, { passive: false });
            document.addEventListener('touchend', handleEnd);
            document.addEventListener('touchcancel', handleEnd);
            
            draggableWindow.style.cursor = 'grabbing';
        };

        // 🔧 同时监听鼠标和触摸事件
        document.addEventListener('mousedown', handleDragStart);
        document.addEventListener('touchstart', handleDragStart, { passive: false });
        
        console.log('[MessageInfoBarRenderer] ✅ 拖拽功能已初始化（支持桌面端和移动端）');
    }

    /**
     * 初始化调整大小功能
     */
    initializeResizing() {
        document.addEventListener('mousedown', (e) => {
            const resizeHandle = e.target.closest('.resize-handle');
            if (!resizeHandle) return;

            const resizableWindow = resizeHandle.closest('[data-resizable="true"]');
            if (!resizableWindow) return;

            e.preventDefault();

            const rect = resizableWindow.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = rect.width;
            const startHeight = rect.height;
            const startLeft = rect.left;
            const startTop = rect.top;

            const handleClass = resizeHandle.className;

            const handleMouseMove = (e) => {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                if (handleClass.includes('resize-e')) {
                    newWidth = Math.max(300, startWidth + deltaX);
                }
                if (handleClass.includes('resize-w')) {
                    newWidth = Math.max(300, startWidth - deltaX);
                    newLeft = startLeft + deltaX;
                }
                if (handleClass.includes('resize-s')) {
                    newHeight = Math.max(200, startHeight + deltaY);
                }
                if (handleClass.includes('resize-n')) {
                    newHeight = Math.max(200, startHeight - deltaY);
                    newTop = startTop + deltaY;
                }

                resizableWindow.style.width = newWidth + 'px';
                resizableWindow.style.height = newHeight + 'px';
                resizableWindow.style.left = newLeft + 'px';
                resizableWindow.style.top = newTop + 'px';
                resizableWindow.style.right = 'auto';
                resizableWindow.style.bottom = 'auto';
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    }

    /**
     * 初始化标签页切换
     */
    initializeTabSwitching() {
        document.addEventListener('click', (e) => {
            const tab = e.target.closest('.interactive-tab');
            if (!tab) return;

            const tabContainer = tab.closest('.infobar-interactive-window');
            if (!tabContainer) return;

            const tabId = tab.getAttribute('data-tab');

            // 切换标签页激活状态
            tabContainer.querySelectorAll('.interactive-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 切换内容显示
            tabContainer.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                if (content.getAttribute('data-tab-content') === tabId) {
                    content.classList.add('active');
                }
            });
        });
    }

    /**
     * 初始化浮动小球交互功能
     */
    initializeFloatingOrb() {
        document.addEventListener('click', (e) => {
            const floatingOrb = e.target.closest('.floating-orb');
            if (!floatingOrb) return;

            const container = floatingOrb.closest('.infobar-container');
            if (!container) return;

            const floatingWindow = container.querySelector('.infobar-floating-window');
            if (!floatingWindow) return;

            // 🔧 修复：先获取小球位置，再隐藏小球
            const orbRect = floatingOrb.getBoundingClientRect();
            console.log('[MessageInfoBarRenderer] 🎯 小球位置:', {
                left: orbRect.left,
                top: orbRect.top,
                right: orbRect.right,
                bottom: orbRect.bottom
            });

            // 隐藏小球，显示窗口
            floatingOrb.style.display = 'none';
            floatingWindow.style.display = 'block';

            // 🔧 优化：根据小球位置智能定位窗口
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const windowWidth = 400; // 预估窗口宽度
            const windowHeight = 300; // 预估窗口高度
            
            let left, top;
            
            // 如果小球在右侧，窗口显示在左侧
            if (orbRect.left > viewportWidth / 2) {
                left = Math.max(10, orbRect.left - windowWidth - 20);
            } else {
                // 如果小球在左侧，窗口显示在右侧
                left = Math.min(viewportWidth - windowWidth - 10, orbRect.right + 20);
            }
            
            // 如果小球在下半部分，窗口向上显示
            if (orbRect.top > viewportHeight / 2) {
                top = Math.max(10, orbRect.bottom - windowHeight);
            } else {
                // 如果小球在上半部分，窗口向下显示
                top = Math.min(viewportHeight - windowHeight - 10, orbRect.top);
            }

            floatingWindow.style.position = 'fixed';
            floatingWindow.style.left = left + 'px';
            floatingWindow.style.top = top + 'px';
            floatingWindow.style.right = 'auto';
            floatingWindow.style.bottom = 'auto';
            
            console.log('[MessageInfoBarRenderer] 🎈 窗口定位:', { left, top, orbPosition: { x: orbRect.left, y: orbRect.top } });

            console.log('[MessageInfoBarRenderer] 🎈 浮动小球已展开为窗口');
        });

        // 小球悬停效果
        document.addEventListener('mouseenter', (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;

            const floatingOrb = e.target.closest('.floating-orb');
            if (!floatingOrb) return;

            const tooltip = floatingOrb.querySelector('.orb-tooltip');
            if (tooltip) {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateX(-50%) translateY(-100%) scale(1)';
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;

            const floatingOrb = e.target.closest('.floating-orb');
            if (!floatingOrb) return;

            const tooltip = floatingOrb.querySelector('.orb-tooltip');
            if (tooltip) {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateX(-50%) translateY(-100%) scale(0.8)';
            }
        }, true);

        console.log('[MessageInfoBarRenderer] ✅ 浮动小球交互功能已初始化');
    }

    /**
     * 🔧 将 col_X 尽量转换为“面板配置中声明的真实字段键”（优先 subItems.key）。
     * 目的：与 DataTable 配置保持一致，避免硬编码映射造成错位。
     */
    convertColFieldToStandardName(fieldName, panelKey) {
        try {
            // 🔧 修复：支持纯数字字段名（如 "1", "2", "3"）和 col_X 格式
            let colNumber = null;

            // 检查是否为 col_X 格式
            const colMatch = fieldName.match(/^col_(\d+)$/);
            if (colMatch) {
                colNumber = parseInt(colMatch[1], 10);
                console.log(`[MessageInfoBarRenderer] 🔧 解析列字段: col_${colNumber} (面板: ${panelKey})`);
            }
            // 🔧 新增：检查是否为纯数字字段名
            else if (/^\d+$/.test(fieldName)) {
                colNumber = parseInt(fieldName, 10);
                console.log(`[MessageInfoBarRenderer] 🔧 解析数字字段: ${fieldName} (面板: ${panelKey})`);
            }
            // 非数字字段，直接返回
            else {
                return fieldName;
            }

            // 1) 优先从 DataTable 的启用面板配置中解析 subItems
            const dataTable = window.SillyTavernInfobar?.modules?.dataTable;
            let panelConfig = null;
            try {
                const enabled = dataTable?.getAllEnabledPanels?.();
                if (Array.isArray(enabled)) {
                    panelConfig = enabled.find(p => p?.key === panelKey || p?.id === panelKey);
                } else if (enabled && typeof enabled === 'object') {
                    panelConfig = enabled[panelKey];
                }
            } catch (e) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 获取启用面板配置失败:', e?.message);
            }

            if (panelConfig && Array.isArray(panelConfig.subItems)) {
                const subItem = panelConfig.subItems[colNumber - 1]; // 数字1 对应索引0
                if (subItem && (subItem.key || subItem.name)) {
                    const resolved = subItem.key || subItem.name;
                    console.log(`[MessageInfoBarRenderer] ✅ 字段${colNumber} -> ${resolved} (来自面板配置)`);
                    return resolved;
                }
            }

            // 2) 找不到配置映射时，保持原样，后续用 mapColFieldToDisplayName 获取显示名
            console.log(`[MessageInfoBarRenderer] ⚠️ 未从配置解析到字段，保留原始: ${fieldName}`);
            return fieldName;
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 字段转换失败:', error);
            return fieldName;
        }
    }

    /**
     * 🔧 将字段名映射为显示名称（从数据表格配置中获取真实列标题）
     */
    mapColFieldToDisplayName(fieldName, panelKey) {
        try {
            console.log(`[MessageInfoBarRenderer] 🔧 映射字段 "${fieldName}" (面板: ${panelKey})`);

            // 🔧 修复：从数据表格配置中获取真实的列标题映射
            const dataTable = window.SillyTavernInfobar?.modules?.dataTable;
            if (dataTable) {
                const enabledPanels = dataTable.getAllEnabledPanels();

                // 🔧 增强：支持多种方式查找面板（key、id、name）
                let targetPanel = null;
                
                // 方式1: 通过key查找
                if (panelKey) {
                    targetPanel = enabledPanels.find(panel => panel.key === panelKey);
                }
                
                // 方式2: 通过id查找（如custom1）
                if (!targetPanel && panelKey) {
                    targetPanel = enabledPanels.find(panel => panel.id === panelKey);
                    if (targetPanel) {
                        console.log(`[MessageInfoBarRenderer] 🔧 通过id找到面板: ${panelKey} -> ${targetPanel.name}`);
                    }
                }
                
                // 方式3: 通过name查找
                if (!targetPanel && panelKey) {
                    targetPanel = enabledPanels.find(panel => panel.name === panelKey);
                    if (targetPanel) {
                        console.log(`[MessageInfoBarRenderer] 🔧 通过name找到面板: ${panelKey} -> ${targetPanel.name}`);
                    }
                }

                // 方式4: 特殊处理信息面板（兼容旧逻辑）
                if (!targetPanel && (panelKey === 'info' || panelKey === undefined)) {
                    targetPanel = enabledPanels.find(panel =>
                        panel.name === '信息' ||
                        (panel.key === undefined && panel.name === '信息') ||
                        panel.key === 'info'
                    );
                    if (targetPanel) {
                        console.log(`[MessageInfoBarRenderer] 🔧 通过名称找到信息面板:`, targetPanel?.name);
                    }
                }

                if (targetPanel && targetPanel.subItems) {
                    console.log(`[MessageInfoBarRenderer] 🔧 找到目标面板: ${targetPanel.name}, 子项数量: ${targetPanel.subItems.length}`);

                    // 🔧 修复：检查是否是col_X格式或纯数字格式
                    let colNumber = null;
                    const colMatch = fieldName.match(/^col_(\d+)$/);
                    if (colMatch) {
                        colNumber = parseInt(colMatch[1]);
                        console.log(`[MessageInfoBarRenderer] 🔧 检测到col_X格式: col_${colNumber}`);
                    } else if (/^\d+$/.test(fieldName)) {
                        colNumber = parseInt(fieldName);
                        console.log(`[MessageInfoBarRenderer] 🔧 检测到纯数字格式: ${fieldName}`);
                    }

                    if (colNumber !== null) {
                        const enabledSubItems = targetPanel.subItems.filter(item => item.enabled);
                        console.log(`[MessageInfoBarRenderer] 🔧 启用子项数量: ${enabledSubItems.length}, 查找字段${colNumber}`);

                        if (enabledSubItems[colNumber - 1]) {
                            const realColumnName = enabledSubItems[colNumber - 1].name;
                            console.log(`[MessageInfoBarRenderer] ✅ ${fieldName} -> "${realColumnName}" (面板: ${panelKey})`);
                            return realColumnName;
                        } else {
                            console.log(`[MessageInfoBarRenderer] ⚠️ ${fieldName} 超出启用子项范围 (面板: ${panelKey})`);
                        }
                    }

                    // 如果不是col_X格式，尝试直接匹配字段名
                    const matchedSubItem = targetPanel.subItems.find(item =>
                        item.key === fieldName || item.name === fieldName
                    );
                    if (matchedSubItem) {
                        console.log(`[MessageInfoBarRenderer] ✅ ${fieldName} -> "${matchedSubItem.name}" (面板: ${panelKey})`);
                        return matchedSubItem.name;
                    }
                } else {
                    console.log(`[MessageInfoBarRenderer] ⚠️ 未找到面板配置或子项 (面板: ${panelKey})`);
                }
            }

            // 🔧 备用方案：使用基础的英文字段名到中文显示名的映射
            const basicFieldMappings = {
                personal: {
                    'name': '姓名',
                    'age': '年龄',
                    'gender': '性别',
                    'occupation': '职业',
                    'appearance': '外貌',
                    'personality': '性格'
                },
                world: {
                    'name': '世界名称',
                    'type': '世界类型',
                    'genre': '世界风格',
                    'geography': '地理环境',
                    'locations': '重要地点',
                    'time': '时间设定'
                },
                interaction: {
                    'name': '对象名称',
                    'type': '对象类型',
                    'status': '当前状态',
                    'relationship': '关系类型',
                    'intimacy': '亲密度',
                    'history': '历史记录',
                    'autoRecord': '自动记录'
                }
            };

            // 🔧 修复：使用基础映射作为备用方案
            const panelMapping = basicFieldMappings[panelKey];
            if (panelMapping && panelMapping[fieldName]) {
                const displayName = panelMapping[fieldName];
                console.log(`[MessageInfoBarRenderer] ✅ ${fieldName} -> ${displayName} (面板: ${panelKey}, 基础映射)`);
                return displayName;
            }

            // 如果没有找到映射，返回原字段名
            console.log(`[MessageInfoBarRenderer] ⚠️ ${fieldName} -> ${fieldName} (面板: ${panelKey}, 无映射)`);
            return fieldName;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 字段映射失败:', error);
            return fieldName;
        }
    }

    /**
     * 渲染标准面板
     */
    renderPanel(panelKey, panelData, panelConfig, globalDefaultCollapsed = false) {
        try {
            if (!panelData || Object.keys(panelData).length === 0) {
                return '';
            }

            // 🆕 优化：处理多行数据的选择框功能
            if (Array.isArray(panelData)) {
                console.log(`[MessageInfoBarRenderer] 🔧 处理数组格式面板数据: ${panelKey}, 行数: ${panelData.length}`);
                if (panelData.length === 0) {
                    return '';
                }

                // 🆕 多行数据：自动添加选择框
                if (panelData.length > 1) {
                    console.log(`[MessageInfoBarRenderer] 🆕 检测到多行数据，生成选择框: ${panelKey}`);
                    return this.renderMultiRowPanel(panelKey, panelData, panelConfig, globalDefaultCollapsed);
                }

                // 单行数据：直接使用第一行
                const processedData = panelData[0];
                console.log(`[MessageInfoBarRenderer] 🔧 单行数据，取第一行:`, processedData);
                return this.renderSingleRowPanel(panelKey, processedData, panelConfig, globalDefaultCollapsed);
            } else {
                console.log(`[MessageInfoBarRenderer] 🔧 处理对象格式面板数据: ${panelKey}`);
                return this.renderSingleRowPanel(panelKey, panelData, panelConfig, globalDefaultCollapsed);
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染面板失败:', error);
            return '';
        }
    }

    /**
     * 🆕 渲染单行数据面板（原renderPanel的核心逻辑）
     */
    renderSingleRowPanel(panelKey, panelData, panelConfig, globalDefaultCollapsed = false) {
        try {
            // 过滤系统字段
            const filteredData = this.filterSystemFields(panelData);
            if (!filteredData || Object.keys(filteredData).length === 0) {
                console.log(`[MessageInfoBarRenderer] ⚠️ 过滤后数据为空: ${panelKey}`);
                return '';
            }

            console.log(`[MessageInfoBarRenderer] 🔍 过滤后数据: ${panelKey}`, filteredData);

            // 特殊处理交互对象面板
            if (panelKey === 'interaction') {
                console.log('[MessageInfoBarRenderer] 🔍 开始渲染交互对象面板');
                console.log('[MessageInfoBarRenderer] 🔍 交互面板数据:', filteredData);
                const result = this.renderInteractionPanel(filteredData, panelConfig, globalDefaultCollapsed);
                console.log('[MessageInfoBarRenderer] 🔍 交互面板渲染结果长度:', result.length);
                return result;
            }

            // 特殊处理组织架构面板
            if (panelKey === 'organization') {
                console.log('[MessageInfoBarRenderer] 🔍 开始渲染组织架构面板');
                console.log('[MessageInfoBarRenderer] 🔍 组织面板数据:', filteredData);
                const result = this.renderOrganizationPanel(filteredData, panelConfig, globalDefaultCollapsed);
                console.log('[MessageInfoBarRenderer] 🔍 组织面板渲染结果长度:', result.length);
                return result;
            }

            // 继续原有的渲染逻辑...
            return this.renderStandardPanel(panelKey, filteredData, panelConfig, globalDefaultCollapsed);

        } catch (error) {
            console.error(`[MessageInfoBarRenderer] ❌ 渲染单行面板失败: ${panelKey}`, error);
            return '';
        }
    }

    /**
     * 🆕 渲染多行数据面板（带选择框）
     */
    renderMultiRowPanel(panelKey, panelDataArray, panelConfig, globalDefaultCollapsed = false) {
        try {
            console.log(`[MessageInfoBarRenderer] 🆕 开始渲染多行数据面板: ${panelKey}, 行数: ${panelDataArray.length}`);

            // 获取面板信息
            const panelInfo = this.getPanelInfo(panelKey);
            const defaultCollapsed = globalDefaultCollapsed || panelConfig?.defaultCollapsed || false;

            let html = `
                <div class="infobar-panel" data-panel="${panelKey}">
                    <div class="infobar-panel-header">
                        <div class="infobar-panel-title">
                            <span class="infobar-panel-arrow">${defaultCollapsed ? '▶' : '▼'}</span>
                            <i class="${panelInfo.icon}"></i> ${panelInfo.name}
                        </div>
                    </div>
                    <div class="infobar-panel-content ${defaultCollapsed ? '' : 'expanded'}"
                         style="display: ${defaultCollapsed ? 'none' : 'block'};">
            `;

            // 🆕 添加行选择器
            html += '<div class="infobar-row-selector-wrapper">';
            html += `<select class="infobar-row-selector" data-panel="${panelKey}">`;

            // 生成选择器选项（使用每行第一列数据作为标题）
            panelDataArray.forEach((rowData, index) => {
                const rowTitle = this.generateRowTitle(rowData, index);
                console.log(`[MessageInfoBarRenderer] 🔍 生成行标题 ${index}: ${rowTitle}`);
                html += `<option value="${index}" ${index === 0 ? 'selected' : ''}>${this.escapeHtml(rowTitle)}</option>`;
            });

            html += '</select></div>';

            // 🆕 为每行数据创建详情面板
            html += '<div class="infobar-row-details-container">';

            panelDataArray.forEach((rowData, index) => {
                const displayStyle = index === 0 ? 'block' : 'none';
                html += `<div class="infobar-row-details" data-panel="${panelKey}" data-row-index="${index}" style="display: ${displayStyle};">`;

                // 渲染这一行的数据
                const rowHtml = this.renderRowData(panelKey, rowData, panelConfig);
                html += rowHtml;

                html += '</div>';
            });

            html += '</div>'; // 结束 row-details-container
            html += '</div>'; // 结束 panel-content
            html += '</div>'; // 结束 panel

            console.log(`[MessageInfoBarRenderer] ✅ 多行数据面板渲染完成: ${panelKey}`);
            return html;

        } catch (error) {
            console.error(`[MessageInfoBarRenderer] ❌ 渲染多行面板失败: ${panelKey}`, error);
            return '';
        }
    }

    /**
     * 🆕 生成行标题（使用第一列数据）
     */
    generateRowTitle(rowData, index) {
        try {
            if (!rowData || typeof rowData !== 'object') {
                return `第${index + 1}行`;
            }

            // 过滤系统字段
            const filteredData = this.filterSystemFields(rowData);
            const keys = Object.keys(filteredData);

            if (keys.length === 0) {
                return `第${index + 1}行`;
            }

            // 使用第一列数据作为标题
            const firstKey = keys[0];
            const firstValue = filteredData[firstKey];

            if (firstValue && String(firstValue).trim()) {
                return String(firstValue).trim();
            }

            return `第${index + 1}行`;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 生成行标题失败:', error);
            return `第${index + 1}行`;
        }
    }

    /**
     * 🆕 渲染单行数据内容
     */
    renderRowData(panelKey, rowData, panelConfig) {
        try {
            const filteredData = this.filterSystemFields(rowData);
            if (!filteredData || Object.keys(filteredData).length === 0) {
                return '<div class="infobar-empty">暂无数据</div>';
            }

            let html = '';
            Object.entries(filteredData).forEach(([fieldName, value]) => {
                // 仅渲染启用字段
                if (!this.isFieldEnabled(panelKey, fieldName, panelConfig)) return;
                if (this.isValidDataValue(value)) {
                    // 获取字段显示名称
                    let displayLabel = this.getFieldDisplayNameFromConfig(panelKey, fieldName, panelConfig);
                    if (!displayLabel) {
                        const standardFieldName = this.convertColFieldToStandardName(fieldName, panelKey);
                        displayLabel = this.getUnifiedFieldDisplayName(standardFieldName, panelKey);
                        if (!displayLabel) {
                            displayLabel = this.FIELD_LABELS[standardFieldName] || this.FIELD_LABELS[fieldName];
                            if (!displayLabel) {
                                // 🔧 修复：使用标准回退函数，避免返回错误的字段名
                                displayLabel = this.getStandardDisplayNameFallback(standardFieldName, panelKey) || this.mapColFieldToDisplayName(fieldName, panelKey) || fieldName;
                            }
                        }
                    }

                    html += `
                        <div class="infobar-item">
                            <span class="infobar-item-label">${this.escapeHtml(displayLabel)}:</span>
                            <span class="infobar-item-value">${this.escapeHtml(String(value))}</span>
                        </div>
                    `;
                }
            });

            return html || ''; // 🔧 修复：移除"暂无有效数据"提示，避免空数据时显示不必要的UI

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染行数据失败:', error);
            // 🔧 修复：不显示错误UI，避免插件禁用后无法清理的问题
            return '';
        }
    }

    /**
     * 🆕 渲染标准面板（提取原有逻辑）
     */
    renderStandardPanel(panelKey, filteredData, panelConfig, globalDefaultCollapsed = false) {
        try {
            // 🔧 新增：特殊处理info面板的数组数据（通过面板配置识别信息面板）
            const isInfoPanel = this.isInfoPanel(panelKey, panelConfig);
            console.log(`[MessageInfoBarRenderer] 🔍 面板检查: panelKey="${panelKey || 'undefined'}", isInfoPanel=${isInfoPanel}, 数据类型=${typeof filteredData}, 是否数组=${Array.isArray(filteredData)}`);

            if (isInfoPanel && Array.isArray(filteredData)) {
                console.log('[MessageInfoBarRenderer] 🔍 开始处理info面板数组数据');
                console.log('[MessageInfoBarRenderer] 🔍 Info面板数组长度:', filteredData.length);
                console.log('[MessageInfoBarRenderer] 🔍 Info面板数组内容:', filteredData);

                // 将数组数据转换为对象格式
                const convertedData = {};
                filteredData.forEach((item, index) => {
                    console.log(`[MessageInfoBarRenderer] 🔧 处理数组项${index}:`, item, typeof item);

                    if (item && typeof item === 'object') {
                        // 如果数组元素是对象，将其字段合并到convertedData中
                        console.log(`[MessageInfoBarRenderer] 🔧 展开对象，键:`, Object.keys(item));
                        Object.entries(item).forEach(([key, value]) => {
                            if (!this.SYSTEM_FIELDS.has(key)) {
                                console.log(`[MessageInfoBarRenderer] 🔧 添加字段: ${key} = ${value}`);
                                convertedData[key] = value;
                            } else {
                                console.log(`[MessageInfoBarRenderer] 🔧 跳过系统字段: ${key}`);
                            }
                        });
                    } else {
                        // 如果数组元素是基本类型，使用索引作为字段名
                        const fieldMapping = this.mapColFieldToDisplayName(`col_${index + 1}`, panelKey);
                        const fieldName = fieldMapping || `信息${index + 1}`;
                        console.log(`[MessageInfoBarRenderer] 🔧 添加基本类型: ${fieldName} = ${item}`);
                        convertedData[fieldName] = item;
                    }
                });

                console.log('[MessageInfoBarRenderer] 🔧 Info面板转换后数据:', convertedData);
                filteredData = convertedData;
            }

            // 获取面板信息
            const panelInfo = this.getPanelInfo(panelKey);
            const defaultCollapsed = globalDefaultCollapsed || panelConfig?.defaultCollapsed || false;

            let html = `
                <div class="infobar-panel" data-panel="${panelKey}">
                    <div class="infobar-panel-header">
                        <div class="infobar-panel-title">
                            <span class="infobar-panel-arrow">${defaultCollapsed ? '▶' : '▼'}</span>
                            <i class="${panelInfo.icon}"></i> ${panelInfo.name}
                        </div>
                    </div>
                    <div class="infobar-panel-content ${defaultCollapsed ? '' : 'expanded'}"
                         style="display: ${defaultCollapsed ? 'none' : 'block'};">
            `;

            // 渲染数据项
            Object.entries(filteredData).forEach(([fieldName, value]) => {
                // 仅渲染启用字段
                if (!this.isFieldEnabled(panelKey, fieldName, panelConfig)) return;
                if (this.isValidDataValue(value)) {
                    let displayLabel = this.getFieldDisplayNameFromConfig(panelKey, fieldName, panelConfig);
                    if (!displayLabel) {
                        const standardFieldName = this.convertColFieldToStandardName(fieldName, panelKey);
                        displayLabel = this.getUnifiedFieldDisplayName(standardFieldName, panelKey);
                        if (!displayLabel) {
                            displayLabel = this.FIELD_LABELS[standardFieldName] || this.FIELD_LABELS[fieldName];
                            if (!displayLabel) {
                                // 🔧 修复：使用标准回退函数，避免返回错误的字段名
                                displayLabel = this.getStandardDisplayNameFallback(standardFieldName, panelKey) || this.mapColFieldToDisplayName(fieldName, panelKey) || fieldName;
                            }
                        }
                    }

                    html += `
                        <div class="infobar-item">
                            <span class="infobar-item-label">${this.escapeHtml(displayLabel)}:</span>
                            <span class="infobar-item-value">${this.escapeHtml(String(value))}</span>
                        </div>
                    `;
                }
            });

            html += '</div></div>';
            return html;

        } catch (error) {
            console.error(`[MessageInfoBarRenderer] ❌ 渲染标准面板失败: ${panelKey}`, error);
            return '';
        }
    }

    /**
     * 渲染交互对象面板
     */
    renderInteractionPanel(interactionData, panelConfig, globalDefaultCollapsed = false) {
        try {
            // 🔧 修复：处理数组格式的交互面板数据
            let processedData;
            if (Array.isArray(interactionData)) {
                console.log(`[MessageInfoBarRenderer] 🔧 处理数组格式交互面板数据, 行数: ${interactionData.length}`);
                if (interactionData.length === 0) {
                    return '';
                }
                // 对于数组格式，取第一行数据
                processedData = interactionData[0];
                console.log(`[MessageInfoBarRenderer] 🔧 取第一行交互数据:`, processedData);
            } else {
                console.log(`[MessageInfoBarRenderer] 🔧 处理对象格式交互面板数据`);
                processedData = interactionData;
            }

            if (!processedData || Object.keys(processedData).length === 0) {
                return '';
            }

            const defaultCollapsed = globalDefaultCollapsed || panelConfig?.defaultCollapsed || false;

            let html = `
                <div class="infobar-panel" data-panel="interaction">
                    <div class="infobar-panel-header">
                        <div class="infobar-panel-title">
                            <span class="infobar-panel-arrow">${defaultCollapsed ? '▶' : '▼'}</span>
                            <i class="fa-solid fa-users"></i> 交互对象
                        </div>
                    </div>
                    <div class="infobar-panel-content ${defaultCollapsed ? '' : 'expanded'}"
                         style="display: ${defaultCollapsed ? 'none' : 'block'};">
            `;

            // 按NPC分组数据
            const npcGroups = this.groupNpcData(processedData);
            const npcList = Object.entries(npcGroups);

            console.log('[MessageInfoBarRenderer] 🔍 NPC分组结果:', npcGroups);
            console.log('[MessageInfoBarRenderer] 🔍 NPC列表长度:', npcList.length);

            if (npcList.length > 0) {
                // 添加NPC选择器（始终显示）
                console.log('[MessageInfoBarRenderer] ✅ 开始生成NPC选择器');
                html += '<div class="infobar-npc-selector-wrapper">';
                html += '<select class="infobar-npc-selector">';

                npcList.forEach(([npcId, npcData], index) => {
                    const npcName = this.getNpcDisplayName(npcId, npcData);
                    console.log(`[MessageInfoBarRenderer] 🔍 添加NPC选项: ${npcId} -> ${npcName}`);
                    html += `<option value="${npcId}" ${index === 0 ? 'selected' : ''}>${this.escapeHtml(npcName)}</option>`;
                });

                html += '</select></div>';
                console.log('[MessageInfoBarRenderer] ✅ NPC选择器生成完成');

                // 为每个NPC创建详情面板
                html += '<div class="infobar-npc-details-container">';

                npcList.forEach(([npcId, npcData], index) => {
                    const displayStyle = index === 0 ? 'block' : 'none';
                    html += `<div class="infobar-npc-details" data-npc-id="${npcId}" style="display: ${displayStyle};">`;

                    Object.entries(npcData).forEach(([fieldName, value]) => {
                        // 仅渲染启用字段
                        if (!this.isFieldEnabled('interaction', fieldName, panelConfig)) return;
                        if (this.isValidDataValue(value)) {
                            // 🔧 修复：使用统一的字段映射逻辑，支持col_X格式
                            let displayLabel = this.getFieldDisplayNameFromConfig('interaction', fieldName, panelConfig);
                            if (!displayLabel) {
                                // 🔧 新增：先将col_X格式转换为系统期望的字段名
                                const standardFieldName = this.convertColFieldToStandardName(fieldName, 'interaction');

                                // 优先使用InfoBarSettings的完整映射表（使用转换后的字段名）
                                displayLabel = this.getUnifiedFieldDisplayName(standardFieldName, 'interaction');
                                if (!displayLabel) {
                                    // 备用：使用本地FIELD_LABELS映射表
                                    displayLabel = this.FIELD_LABELS[standardFieldName] || this.FIELD_LABELS[fieldName];
                                    if (!displayLabel) {
                                        // 最后备用：使用我的col_X映射
                                        // 🔧 修复：使用标准回退函数
                                        displayLabel = this.getStandardDisplayNameFallback(standardFieldName, 'interaction') || this.mapColFieldToDisplayName(fieldName, 'interaction') || fieldName;
                                    }
                                }
                            }
                            console.log(`[MessageInfoBarRenderer] 🔍 交互面板字段映射: ${fieldName} -> ${displayLabel}`);

                            html += `
                                <div class="infobar-item">
                                    <span class="infobar-item-label">${this.escapeHtml(displayLabel)}:</span>
                                    <span class="infobar-item-value">${this.escapeHtml(String(value))}</span>
                                </div>
                            `;
                        }
                    });

                    html += `</div>`;
                });

                html += '</div>';
            } else {
                html += '<div class="infobar-item">暂无交互对象数据</div>';
            }

            html += `</div></div>`;
            return html;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染交互对象面板失败:', error);
            return '';
        }
    }

    /**
     * 渲染组织架构面板
     */
    renderOrganizationPanel(organizationData, panelConfig, globalDefaultCollapsed = false) {
        try {
            if (!organizationData || Object.keys(organizationData).length === 0) {
                return '';
            }

            const defaultCollapsed = globalDefaultCollapsed || panelConfig?.defaultCollapsed || false;

            let html = `
                <div class="infobar-panel" data-panel="organization">
                    <div class="infobar-panel-header">
                        <div class="infobar-panel-title">
                            <span class="infobar-panel-arrow">${defaultCollapsed ? '▶' : '▼'}</span>
                            <i class="fa-solid fa-building"></i> 组织架构
                        </div>
                    </div>
                    <div class="infobar-panel-content ${defaultCollapsed ? '' : 'expanded'}"
                         style="display: ${defaultCollapsed ? 'none' : 'block'};">
            `;

            // 按组织分组数据
            const orgGroups = this.groupOrgData(organizationData);
            const orgList = Object.entries(orgGroups);

            console.log('[MessageInfoBarRenderer] 🔍 组织分组结果:', orgGroups);
            console.log('[MessageInfoBarRenderer] 🔍 组织列表长度:', orgList.length);

            if (orgList.length > 0) {
                // 添加组织选择器（始终显示）
                console.log('[MessageInfoBarRenderer] ✅ 开始生成组织选择器');
                html += '<div class="infobar-org-selector-wrapper">';
                html += '<select class="infobar-org-selector">';

                orgList.forEach(([orgId, orgData], index) => {
                    const orgName = this.getOrgDisplayName(orgId, orgData);
                    console.log(`[MessageInfoBarRenderer] 🔍 添加组织选项: ${orgId} -> ${orgName}`);
                    html += `<option value="${orgId}" ${index === 0 ? 'selected' : ''}>${this.escapeHtml(orgName)}</option>`;
                });

                html += '</select></div>';
                console.log('[MessageInfoBarRenderer] ✅ 组织选择器生成完成');

                // 为每个组织创建详情面板
                html += '<div class="infobar-org-details-container">';

                orgList.forEach(([orgId, orgData], index) => {
                    const displayStyle = index === 0 ? 'block' : 'none';
                    html += `<div class="infobar-org-details" data-org-id="${orgId}" style="display: ${displayStyle};">`;

                    Object.entries(orgData).forEach(([fieldName, value]) => {
                        // 仅渲染启用字段
                        if (!this.isFieldEnabled('organization', fieldName, panelConfig)) return;
                        if (this.isValidDataValue(value)) {
                            // 🔧 修复：使用统一的字段映射逻辑
                            let displayLabel = this.getFieldDisplayNameFromConfig('organization', fieldName, panelConfig);
                            if (!displayLabel) {
                                // 🔧 新增：先将col_X格式转换为系统期望的字段名
                                const standardFieldName = this.convertColFieldToStandardName(fieldName, 'organization');

                                // 优先使用InfoBarSettings的完整映射表（使用转换后的字段名）
                                displayLabel = this.getUnifiedFieldDisplayName(standardFieldName, 'organization');
                                if (!displayLabel) {
                                    // 备用：使用本地FIELD_LABELS映射表
                                    displayLabel = this.FIELD_LABELS[standardFieldName] || this.FIELD_LABELS[fieldName];
                                    if (!displayLabel) {
                                        // 最后备用：使用我的字段映射
                                        // 🔧 修复：使用标准回退函数
                                        displayLabel = this.getStandardDisplayNameFallback(standardFieldName, 'organization') || this.mapColFieldToDisplayName(fieldName, 'organization') || fieldName;
                                    }
                                }
                            }
                            console.log(`[MessageInfoBarRenderer] 🔍 组织面板字段映射: ${fieldName} -> ${displayLabel}`);

                            html += `
                                <div class="infobar-item">
                                    <span class="infobar-item-label">${this.escapeHtml(displayLabel)}:</span>
                                    <span class="infobar-item-value">${this.escapeHtml(String(value))}</span>
                                </div>
                            `;
                        }
                    });

                    html += `</div>`;
                });

                html += '</div>';
            } else {
                html += '<div class="infobar-item">暂无组织数据</div>';
            }

            html += `</div></div>`;
            return html;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染组织架构面板失败:', error);
            return '';
        }
    }

    /**
     * 将信息栏插入到消息中
     */
    insertInfoBarToMessage(messageId, infoBarHtml, style) {
        try {
            // 查找消息元素
            const messageElement = document.querySelector(`[mesid="${messageId}"]`);
            if (!messageElement) {
                console.warn('[MessageInfoBarRenderer] ❌ 找不到消息元素:', messageId);
                return false;
            }

            // 检查是否为AI消息
            const isUserMessage = messageElement.classList.contains('user') ||
                                 messageElement.querySelector('.mes_text')?.closest('.user') ||
                                 messageElement.getAttribute('is_user') === 'true';

            if (isUserMessage) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 拒绝将信息栏绑定到用户消息:', messageId);
                return false;
            }

            // 根据风格选择插入方式
            return this.insertInfoBarByStyle(messageElement, infoBarHtml, style, messageId);

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 插入信息栏失败:', error);
            return false;
        }
    }

    /**
     * 根据风格插入信息栏
     */
    insertInfoBarByStyle(messageElement, infoBarHtml, style, messageId) {
        try {
            // 清理现有信息栏
            this.cleanupExistingInfoBar(messageElement);

            let infoBarElement;

            switch (style.id) {
                case 'end-generated':
                    infoBarElement = this.insertEndGeneratedStyle(messageElement, infoBarHtml);
                    break;
                case 'flat':
                    // 与结尾生成式相同的插入位置（消息末尾）
                    infoBarElement = this.insertEndGeneratedStyle(messageElement, infoBarHtml);
                    break;
                case 'conversation-wrapped':
                    infoBarElement = this.insertWrappedStyle(messageElement, infoBarHtml);
                    break;
                case 'floating':
                    infoBarElement = this.insertFloatingStyle(messageElement, infoBarHtml);
                    break;
                case 'embedded':
                    infoBarElement = this.insertEmbeddedStyle(messageElement, infoBarHtml);
                    break;
                case 'interactive':
                    infoBarElement = this.insertInteractiveStyle(messageElement, infoBarHtml);
                    break;
                case 'custom-html':
                    infoBarElement = this.insertCustomHTMLStyle(messageElement, infoBarHtml);
                    break;
                default:
                    infoBarElement = this.insertEndGeneratedStyle(messageElement, infoBarHtml);
            }

            if (infoBarElement) {
                this.bindInfoBarEvents(infoBarElement);
                this.applyCurrentTheme(infoBarElement);
                console.log('[MessageInfoBarRenderer] ✅ 信息栏已插入并绑定事件，风格:', style.name);
                return true;
            }

            return false;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 根据风格插入信息栏失败:', error);
            return false;
        }
    }

    /**
     * 清理现有信息栏
     */
    cleanupExistingInfoBar(messageElement) {
        const existingInfoBars = messageElement.querySelectorAll('.infobar-container');
        existingInfoBars.forEach(bar => bar.remove());

        // 清理可能的浮动窗口
        document.querySelectorAll('.infobar-style-floating, .infobar-style-interactive').forEach(bar => {
            if (bar.getAttribute('data-message-id') === messageElement.getAttribute('mesid')) {
                bar.remove();
            }
        });
    }

    /**
     * 插入结尾生成式风格
     */
    insertEndGeneratedStyle(messageElement, infoBarHtml) {
        const chatTextElement = messageElement.querySelector('.mes_text');
        if (!chatTextElement) return null;

        chatTextElement.insertAdjacentHTML('beforeend', infoBarHtml);
        return messageElement.querySelector('.infobar-container');
    }

    /**
     * 插入对话包裹式风格
     */
    insertWrappedStyle(messageElement, infoBarHtml) {
        const chatTextElement = messageElement.querySelector('.mes_text');
        if (!chatTextElement) return null;

        // 包裹现有内容
        const originalContent = chatTextElement.innerHTML;
        chatTextElement.innerHTML = '';

        const wrappedHtml = infoBarHtml.replace(
            '<div class="infobar-content">',
            `<div class="infobar-content"><div class="original-message-content">${originalContent}</div>`
        );

        chatTextElement.insertAdjacentHTML('afterbegin', wrappedHtml);
        return messageElement.querySelector('.infobar-container');
    }

    /**
     * 插入浮动式风格（改为全局唯一实例，重复渲染仅更新内容）
     */
    insertFloatingStyle(messageElement, infoBarHtml) {
        try {
            // 查找全局唯一的浮动信息栏容器
            const existing = document.querySelector('#global-floating-infobar');
            if (existing) {
                // 从新HTML中提取面板内容与主题样式
                const temp = document.createElement('div');
                temp.innerHTML = infoBarHtml;
                const newPanels = temp.querySelector('.infobar-panels');
                const newContainer = temp.querySelector('.infobar-container');

                // 更新主题样式（若有变化）
                if (newContainer && newContainer.getAttribute('style')) {
                    existing.setAttribute('style', newContainer.getAttribute('style'));
                }

                // 仅更新面板内容，保持小球/窗口现有展开状态
                const targetPanels = existing.querySelector('.infobar-panels');
                if (newPanels && targetPanels) {
                    targetPanels.innerHTML = newPanels.innerHTML;
                }

                // 更新附加属性（可选，不使用 messageId 以避免被清理）
                existing.setAttribute('data-last-update', Date.now());
                return existing;
            }

            // 首次创建：将容器设为全局唯一
            const temp = document.createElement('div');
            temp.innerHTML = infoBarHtml;
            const container = temp.querySelector('.infobar-container');
            if (container) {
                container.id = 'global-floating-infobar';
                container.setAttribute('data-global', 'true');
                // 该容器作为全局实例，不绑定到特定消息
                container.removeAttribute('data-message-id');
            }

            // 插入到 body
            if (container) {
                document.body.insertAdjacentElement('beforeend', container);
            } else {
                // 回退：若未能解析到容器，则直接插入原HTML
                document.body.insertAdjacentHTML('beforeend', infoBarHtml);
            }
            return document.querySelector('#global-floating-infobar') || document.querySelector('.infobar-container.infobar-style-floating');
        } catch (e) {
            console.error('[MessageInfoBarRenderer] ❌ 插入/更新浮动式信息栏失败:', e);
            // 回退：保持原行为，避免功能中断
            document.body.insertAdjacentHTML('beforeend', infoBarHtml);
            return document.querySelector(`.infobar-container[data-message-id="${messageElement.getAttribute('mesid')}"]`);
        }
    }

    /**
     * 插入内嵌式风格
     */
    insertEmbeddedStyle(messageElement, infoBarHtml) {
        const chatTextElement = messageElement.querySelector('.mes_text');
        if (!chatTextElement) return null;

        // 在消息内容中间插入
        const originalContent = chatTextElement.innerHTML;
        const midPoint = Math.floor(originalContent.length / 2);
        const beforeContent = originalContent.substring(0, midPoint);
        const afterContent = originalContent.substring(midPoint);

        chatTextElement.innerHTML = beforeContent + infoBarHtml + afterContent;
        return messageElement.querySelector('.infobar-container');
    }

    /**
     * 插入前端交互式风格
     */
    insertInteractiveStyle(messageElement, infoBarHtml) {
        // 插入到body中，作为独立的交互式窗口
        document.body.insertAdjacentHTML('beforeend', infoBarHtml);
        return document.querySelector(`.infobar-container[data-message-id="${messageElement.getAttribute('mesid')}"]`);
    }

    /**
     * 插入自定义HTML模板风格
     */
    insertCustomHTMLStyle(messageElement, infoBarHtml) {
        try {
            const chatTextElement = messageElement.querySelector('.mes_text');
            if (!chatTextElement) return null;

            // 在消息末尾插入自定义HTML模板
            chatTextElement.insertAdjacentHTML('beforeend', infoBarHtml);
            // 作用域隔离与尺寸约束：将自定义HTML放入Shadow DOM并按容器约束缩放
            const container = messageElement.querySelector('.infobar-container.infobar-style-custom-html');
            try {
                if (container) {
                    this.setupCustomHTMLContainer(container);
                }
            } catch (e) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 自定义HTML Shadow封装失败，继续以普通模式渲染:', e);
            }

            // 返回插入的容器元素
            return container || messageElement.querySelector('.infobar-container');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 插入自定义HTML模板失败:', error);
            return null;
        }
    }

    /**
     * 🔧 新增：从HTML中提取所有样式内容
     * 解决Shadow DOM中CSS样式隔离导致的样式失效问题
     */
    extractStylesFromHTML(html) {
        try {
            console.log('[MessageInfoBarRenderer] 🎨 提取HTML中的样式...');

            let extractedStyles = '';

            // 1. 提取<style>标签中的内容
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
            let styleMatch;
            while ((styleMatch = styleRegex.exec(html)) !== null) {
                extractedStyles += styleMatch[1] + '\n';
            }

            // 2. 提取<link>标签中的CSS（转换为@import）
            const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
            let linkMatch;
            while ((linkMatch = linkRegex.exec(html)) !== null) {
                const href = linkMatch[1];
                // 只处理外部CSS链接，避免本地文件路径问题
                if (href.startsWith('http') || href.startsWith('//')) {
                    extractedStyles += `@import url("${href}");\n`;
                }
            }

            // 3. 提取内联样式（将内联样式转换为CSS规则）
            const inlineStyleRegex = /style=["']([^"']+)["']/gi;
            let inlineMatch;
            let inlineCounter = 0;
            while ((inlineMatch = inlineStyleRegex.exec(html)) !== null) {
                const inlineStyle = inlineMatch[1];
                // 为内联样式创建唯一的类名
                const className = `inline-style-${inlineCounter++}`;
                extractedStyles += `.${className} { ${inlineStyle} }\n`;
            }

            console.log('[MessageInfoBarRenderer] ✅ 样式提取完成，长度:', extractedStyles.length);

            // 🔧 修复CSS选择器兼容性问题
            if (extractedStyles.length > 0) {
                // 将body选择器替换为.custom-root，确保样式能在Shadow DOM中正确应用
                extractedStyles = extractedStyles.replace(/\bbody\s*\{/g, '.custom-root {');
                extractedStyles = extractedStyles.replace(/\bbody\s*,/g, '.custom-root,');
                extractedStyles = extractedStyles.replace(/,\s*body\s*\{/g, ', .custom-root {');

                // 确保html选择器也能正确应用
                extractedStyles = extractedStyles.replace(/\bhtml\s*\{/g, ':host {');
                extractedStyles = extractedStyles.replace(/\bhtml\s*,/g, ':host,');

                // 🔧 移除可能导致透明背景的CSS规则
                extractedStyles = extractedStyles.replace(/background:\s*transparent\s*;/g, '/* background: transparent removed */');
                extractedStyles = extractedStyles.replace(/background-color:\s*transparent\s*;/g, '/* background-color: transparent removed */');

                console.log('[MessageInfoBarRenderer] 🔧 CSS选择器修复完成');

                // 详细的样式提取日志
                const stylePreview = extractedStyles.substring(0, 300);
                console.log('[MessageInfoBarRenderer] 📋 修复后样式预览:', stylePreview + '...');

                // 检查关键CSS变量和选择器
                const hasRootVars = extractedStyles.includes(':root');
                const hasBgGradient = extractedStyles.includes('--bg-gradient') || extractedStyles.includes('#fff0f5');
                const hasCardBg = extractedStyles.includes('--card-bg') || extractedStyles.includes('rgba(255, 255, 255');
                const hasTextAccent = extractedStyles.includes('--text-accent') || extractedStyles.includes('#d9538d');
                const hasBodyReplaced = extractedStyles.includes('.custom-root {');

                console.log('[MessageInfoBarRenderer] 🎨 CSS修复检查:', {
                    根变量: hasRootVars,
                    背景渐变: hasBgGradient,
                    卡片背景: hasCardBg,
                    强调色: hasTextAccent,
                    body选择器已替换: hasBodyReplaced
                });

                if (!hasBgGradient || !hasCardBg) {
                    console.warn('[MessageInfoBarRenderer] ⚠️ 关键CSS样式可能缺失，这可能导致样式问题');
                }
            } else {
                console.warn('[MessageInfoBarRenderer] ⚠️ 未提取到任何CSS样式');
            }

            return extractedStyles;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 提取样式失败:', error);
            return '';
        }
    }

    /**
     * 🔧 新增：清理HTML内容用于Shadow DOM
     * 移除<head>、<style>、<link>等标签，只保留<body>内容
     */
    cleanHTMLForShadowDOM(html) {
        try {
            console.log('[MessageInfoBarRenderer] 🧹 清理HTML内容用于Shadow DOM...');

            let cleanedHTML = html;

            // 1. 移除<!DOCTYPE>声明
            cleanedHTML = cleanedHTML.replace(/<!DOCTYPE[^>]*>/gi, '');

            // 2. 移除<html>标签，保留内容
            cleanedHTML = cleanedHTML.replace(/<html[^>]*>/gi, '').replace(/<\/html>/gi, '');

            // 3. 移除整个<head>部分
            cleanedHTML = cleanedHTML.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

            // 4. 移除<body>标签，保留内容
            cleanedHTML = cleanedHTML.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '');

            // 5. 移除剩余的<style>和<link>标签
            cleanedHTML = cleanedHTML.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
            cleanedHTML = cleanedHTML.replace(/<link[^>]*>/gi, '');

            // 6. 移除<script>标签（保留内容供后续处理）
            // 注意：不移除script标签，因为executeCustomHTMLScripts方法需要处理它们

            console.log('[MessageInfoBarRenderer] ✅ HTML清理完成');
            console.log('[MessageInfoBarRenderer] 📋 清理前长度:', html.length, '清理后长度:', cleanedHTML.length);

            return cleanedHTML.trim();

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 清理HTML失败:', error);
            return html; // 返回原始HTML作为备用
        }
    }

    /**
     * 将自定义HTML封装到Shadow DOM中并应用比例缩放，避免样式外溢与布局溢出
     */
    setupCustomHTMLContainer(container) {
        const wrapper = container.querySelector('.custom-html-wrapper');
        if (!wrapper || wrapper.getAttribute('data-shadow') === 'true') return;

        // 读取原有HTML并清空
        const originalHTML = wrapper.innerHTML;
        wrapper.innerHTML = '';

        // 附加Shadow Root
        const shadowRoot = wrapper.attachShadow({ mode: 'open' });

        // 🔧 修复：提取并注入原HTML中的所有样式到Shadow DOM
        const extractedStyles = this.extractStylesFromHTML(originalHTML);

        // 🔧 清理HTML内容：移除<head>、<style>、<link>标签，只保留<body>内容
        const cleanedHTML = this.cleanHTMLForShadowDOM(originalHTML);

        // 注入提取的样式和安全样式（仅作用于Shadow范围内）
        const style = document.createElement('style');
        style.textContent = `
            /* 🎨 注入原HTML中的所有样式 */
            ${extractedStyles}

            /* Shadow DOM容器样式 */
            :host {
                display: block;
                max-width: 100%;
                /* 🔥 大幅增加容器尺寸，优先保证内容显示 */
                min-height: 120px; /* 从40px增加到120px */
                min-width: 300px; /* 从200px增加到300px */
                max-height: none; /* 移除最大高度限制 */
            }
            .custom-root {
                position: relative;
                display: block;
                max-width: 100%;
                overflow: visible; /* 从hidden改为visible，允许内容显示 */
                /* 🔥 更大的布局控制，优先内容显示 */
                min-height: 120px; /* 确保足够高度 */
                /* 🔧 移除background: transparent，避免覆盖用户自定义背景 */
            }
            .scale-inner {
                transform-origin: top left;
                will-change: transform;
                /* 🎨 确保内容可见和可交互 */
                pointer-events: auto;
                user-select: text;
                position: relative;
                z-index: 1;
            }
            /* 限制影子内部滚动，尽量由外层容器管理高度 */
            .custom-root * {
                box-sizing: border-box;
            }
            /* 🚀 增强交互性：确保按钮和链接可点击 */
            .custom-root button,
            .custom-root a,
            .custom-root [onclick],
            .custom-root [data-action],
            .custom-root .clickable,
            .custom-root input,
            .custom-root select,
            .custom-root textarea {
                pointer-events: auto !important;
                cursor: pointer;
                position: relative;
                z-index: 10;
            }
            /* 🔥 状态栏专用优化：大幅增加显示空间 */
            .infobar-container,
            .infobar-wrapper {
                pointer-events: auto !important;
                min-height: 150px; /* 从30px增加到150px */
                max-height: none; /* 移除高度限制 */
            }
            /* 🚀 确保状态栏内容有足够空间 */
            .infobar-container.infobar-style-custom-html {
                min-height: 200px; /* 自定义HTML样式更大空间 */
            }
        `;
        shadowRoot.appendChild(style);

        // 内容根节点，用于测量与缩放
        const root = document.createElement('div');
        root.className = 'custom-root';
        const scaleInner = document.createElement('div');
        scaleInner.className = 'scale-inner';
        scaleInner.innerHTML = cleanedHTML; // 🔧 使用清理后的HTML
        root.appendChild(scaleInner);
        shadowRoot.appendChild(root);

        // 标记已封装
        wrapper.setAttribute('data-shadow', 'true');

        // 🚀 **关键修复**: 执行用户自定义HTML中的JavaScript代码
        this.executeCustomHTMLScripts(shadowRoot);

        // 🚀 设置Shadow DOM事件代理（作为备用方案）
        this.setupShadowDOMEventHandling(shadowRoot, container);

        // 应用首次缩放并注册窗口缩放监听
        const apply = () => {
            try {
                this.applyCustomHTMLScaling(container, wrapper, root, scaleInner);
            } catch (e) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 自定义HTML比例适配失败（可忽略）:', e);
            }
        };

        // 初次渲染后多次尝试，适配字体与外链样式加载延迟
        requestAnimationFrame(() => {
            apply();
            setTimeout(apply, 50);
            setTimeout(apply, 200);
            setTimeout(apply, 600);
        });
        window.addEventListener('resize', apply, { passive: true });
    }

    /**
     * 🚀 新增：设置Shadow DOM事件处理机制
     */
    setupShadowDOMEventHandling(shadowRoot, container) {
        try {
            console.log('[MessageInfoBarRenderer] 🎯 设置Shadow DOM事件代理...');

            // 获取消息ID用于事件处理
            const messageId = (container && container.getAttribute('data-message-id')) || 'unknown';

            // 在Shadow Root内部添加事件监听器
            shadowRoot.addEventListener('click', (e) => {
                this.handleShadowDOMClick(e, messageId, container);
            }, true); // 使用捕获阶段确保能够接收到事件

            shadowRoot.addEventListener('mousedown', (e) => {
                // 阻止事件冒泡到外部，避免干扰拖拽等功能
                e.stopPropagation();
            }, true);

            // 处理键盘事件（用于可访问性）
            shadowRoot.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    const target = e.target;
                    if (target && (target.onclick || target.getAttribute('data-action'))) {
                        e.preventDefault();
                        this.handleShadowDOMClick(e, messageId, container);
                    }
                }
            }, true);

            console.log('[MessageInfoBarRenderer] ✅ Shadow DOM事件代理设置完成');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 设置Shadow DOM事件处理失败:', error);
        }
    }

    /**
     * 🎯 处理Shadow DOM内的点击事件
     */
    handleShadowDOMClick(e, messageId, container) {
        try {
            const target = e.target;
            if (!target) return;

            // 🔍 查找具有点击行为的元素
            const clickableElement = target.closest('button, a, [onclick], [data-action], .clickable, .wrapper-toggle');
            if (!clickableElement) return;

            console.log('[MessageInfoBarRenderer] 🎯 处理Shadow DOM点击:', {
                tagName: clickableElement.tagName,
                className: clickableElement.className,
                onclick: !!clickableElement.onclick,
                dataAction: clickableElement.getAttribute('data-action'),
                text: clickableElement.textContent?.trim()
            });

            // 🚀 优先让HTML模板内的JavaScript代码处理事件
            // 检查是否有内联的onclick或者data-tab属性（用户自定义模板的标准）
            if (clickableElement.onclick) {
                try {
                    clickableElement.onclick.call(clickableElement, e);
                    console.log('[MessageInfoBarRenderer] ✅ 执行onclick事件成功');
                    return; // 成功执行，直接返回
                } catch (error) {
                    console.warn('[MessageInfoBarRenderer] ⚠️ 执行onclick事件失败:', error);
                }
            }

            // 🎯 处理用户自定义HTML模板中的标签页切换
            if (clickableElement.classList.contains('main-tab-btn') || clickableElement.dataset.tab) {
                this.handleCustomTabSwitch(clickableElement, e.currentTarget);
                return;
            }

            // 🔧 处理其他自定义动作
            if (clickableElement.getAttribute('data-action')) {
                const action = clickableElement.getAttribute('data-action');
                this.handleCustomAction(action, messageId, clickableElement, container);
            } else if (clickableElement.classList.contains('wrapper-toggle')) {
                const wrapper = clickableElement.closest('.infobar-wrapper');
                if (wrapper) {
                    wrapper.classList.toggle('collapsed');
                    console.log('[MessageInfoBarRenderer] 🎯 切换状态栏折叠状态');
                }
            } else if (clickableElement.tagName === 'A' && clickableElement.href) {
                if (clickableElement.target === '_blank') {
                    window.open(clickableElement.href, '_blank');
                } else {
                    window.location.href = clickableElement.href;
                }
                console.log('[MessageInfoBarRenderer] 🔗 处理链接点击');
            } else if (clickableElement.tagName === 'BUTTON') {
                // 🔥 最后才尝试通用按钮处理，并且确保container有效
                if (container) {
                    this.handleGenericButtonClick(clickableElement, messageId, container);
                } else {
                    console.warn('[MessageInfoBarRenderer] ⚠️ Container为null，使用简化处理');
                    this.handleSimpleButtonClick(clickableElement);
                }
            }

            // 只在必要时阻止事件传播
            e.stopPropagation();

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理Shadow DOM点击事件失败:', error);
        }
    }

    /**
     * 🎯 处理用户自定义HTML模板中的标签页切换
     */
    handleCustomTabSwitch(clickedButton, shadowRoot) {
        try {
            const targetTab = clickedButton.dataset.tab;
            console.log('[MessageInfoBarRenderer] 🎮 处理自定义标签页切换:', targetTab);

            // 在Shadow DOM中查找所有标签按钮和内容区域
            const tabButtons = shadowRoot.querySelectorAll('.main-tab-btn');
            const tabContents = shadowRoot.querySelectorAll('main[id^="tab-"]');

            // 移除所有active类
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 激活点击的按钮
            clickedButton.classList.add('active');

            // 激活对应的内容区域
            if (targetTab) {
                const targetContent = shadowRoot.querySelector(`#${targetTab}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                    console.log('[MessageInfoBarRenderer] ✅ 标签页切换成功:', targetTab);
                }
            }

            // 🎨 提供视觉反馈
            this.provideButtonFeedback(clickedButton);

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理自定义标签页切换失败:', error);
        }
    }

    /**
     * 🔧 简化按钮点击处理（当container为null时使用）
     */
    handleSimpleButtonClick(button) {
        try {
            const buttonText = button.textContent?.trim() || '';
            console.log('[MessageInfoBarRenderer] 🔧 简化按钮处理:', buttonText);

            // 基本的视觉反馈
            this.provideButtonFeedback(button);

            // 简单的通知
            this.showNotification(`🎯 ${buttonText} 已被触发`, 'info');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 简化按钮处理失败:', error);
        }
    }

    /**
     * 🔥 新增：处理通用按钮点击（没有明确事件的按钮）
     */
    handleGenericButtonClick(button, messageId, container) {
        try {
            const buttonText = button.textContent?.trim() || '';
            const buttonClass = button.className || '';
            const buttonId = button.id || '';

            console.log('[MessageInfoBarRenderer] 🎮 处理通用按钮点击:', {
                text: buttonText,
                class: buttonClass,
                id: buttonId
            });

            // 🎯 根据按钮文本和类名判断功能
            const buttonActions = {
                // 状态栏标签页
                '史程征途': () => this.switchToTab('history', container),
                '世界地图': () => this.switchToTab('worldMap', container),
                '据点建设': () => this.switchToTab('baseBuilding', container),
                '世界图鉴': () => this.switchToTab('worldAtlas', container),
                
                // 物品相关
                '使用物品': () => this.handleInventoryAction('use', container),
                '整理物品': () => this.handleInventoryAction('organize', container),
                '获取物品': () => this.handleInventoryAction('acquire', container),
                
                // 动作按钮
                '选择立国据点': () => this.handleGameAction('selectFoundationSite', container),
                '窥探建设': () => this.handleGameAction('spyConstruction', container),
                '执行队列': () => this.handleGameAction('executeQueue', container),
                
                // 资源相关
                '获取': () => this.handleResourceAction('acquire', button, container),
                '使用': () => this.handleResourceAction('use', button, container),
                
                // 通用操作
                '详情': () => this.showDetails(button, container),
                '查看': () => this.showDetails(button, container),
                '展开': () => this.toggleExpansion(button, container),
                '收起': () => this.toggleExpansion(button, container),
            };

            // 🚀 执行对应的动作
            const action = buttonActions[buttonText];
            if (action) {
                action();
                console.log('[MessageInfoBarRenderer] ✅ 执行按钮动作成功:', buttonText);
                
                // 🎨 提供视觉反馈
                this.provideButtonFeedback(button);
            } else {
                // 🔍 如果没有预定义动作，尝试通用处理
                this.handleUnknownButtonClick(button, messageId, container);
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理通用按钮点击失败:', error);
        }
    }

    /**
     * 🎮 切换标签页
     */
    switchToTab(tabName, container) {
        try {
            console.log('[MessageInfoBarRenderer] 🎮 切换标签页:', tabName);
            
            // 查找所有标签按钮和内容区域
            const shadowRoot = container.shadowRoot || container.querySelector(':scope').shadowRoot;
            if (shadowRoot) {
                // 更新标签按钮状态
                const tabButtons = shadowRoot.querySelectorAll('.main-tab-btn');
                tabButtons.forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // 激活当前按钮
                const currentButton = Array.from(tabButtons).find(btn => {
                    const text = btn.textContent.trim();
                    return (tabName === 'history' && text === '史程征途') ||
                           (tabName === 'worldMap' && text === '世界地图') ||
                           (tabName === 'baseBuilding' && text === '据点建设') ||
                           (tabName === 'worldAtlas' && text === '世界图鉴');
                });
                
                if (currentButton) {
                    currentButton.classList.add('active');
                }
                
                // 切换内容显示区域
                this.updateTabContent(tabName, shadowRoot);
            }
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 切换标签页失败:', error);
        }
    }

    /**
     * 🎯 更新标签页内容
     */
    updateTabContent(tabName, shadowRoot) {
        try {
            // 查找内容区域
            const contentAreas = shadowRoot.querySelectorAll('.tab-content');
            contentAreas.forEach(area => {
                area.style.display = 'none';
            });
            
            // 显示对应内容
            const targetArea = shadowRoot.querySelector(`[data-tab="${tabName}"]`);
            if (targetArea) {
                targetArea.style.display = 'block';
            }
            
            console.log('[MessageInfoBarRenderer] 🎯 已更新标签页内容:', tabName);
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 更新标签页内容失败:', error);
        }
    }

    /**
     * 🎒 处理物品相关动作
     */
    handleInventoryAction(action, container) {
        try {
            console.log('[MessageInfoBarRenderer] 🎒 处理物品动作:', action);
            
            const actions = {
                'use': () => {
                    this.showNotification('💊 使用物品功能已激活', 'success');
                    console.log('[MessageInfoBarRenderer] 🎮 执行使用物品动作');
                },
                'organize': () => {
                    this.showNotification('📦 物品整理功能已激活', 'info');
                    console.log('[MessageInfoBarRenderer] 🎮 执行整理物品动作');
                },
                'acquire': () => {
                    this.showNotification('🎁 获取物品功能已激活', 'success');
                    console.log('[MessageInfoBarRenderer] 🎮 执行获取物品动作');
                }
            };
            
            if (actions[action]) {
                actions[action]();
            }
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理物品动作失败:', error);
        }
    }

    /**
     * 🎮 处理游戏动作
     */
    handleGameAction(action, container) {
        try {
            console.log('[MessageInfoBarRenderer] 🎮 处理游戏动作:', action);
            
            const actions = {
                'selectFoundationSite': () => {
                    this.showNotification('🏰 立国据点选择功能已激活', 'info');
                    console.log('[MessageInfoBarRenderer] 🎮 执行选择立国据点动作');
                },
                'spyConstruction': () => {
                    this.showNotification('🔍 窥探建设功能已激活', 'warning');
                    console.log('[MessageInfoBarRenderer] 🎮 执行窥探建设动作');
                },
                'executeQueue': () => {
                    this.showNotification('⚡ 队列执行功能已激活', 'success');
                    console.log('[MessageInfoBarRenderer] 🎮 执行队列动作');
                }
            };
            
            if (actions[action]) {
                actions[action]();
            }
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理游戏动作失败:', error);
        }
    }

    /**
     * 💎 处理资源动作
     */
    handleResourceAction(action, button, container) {
        try {
            const resourceType = this.getResourceTypeFromContext(button);
            console.log('[MessageInfoBarRenderer] 💎 处理资源动作:', action, resourceType);
            
            const message = action === 'acquire' ? 
                `🎁 已获取${resourceType}资源` : 
                `💫 已使用${resourceType}资源`;
            
            this.showNotification(message, 'success');
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理资源动作失败:', error);
        }
    }

    /**
     * 🔍 显示详情
     */
    showDetails(button, container) {
        try {
            const itemName = this.getItemNameFromContext(button);
            console.log('[MessageInfoBarRenderer] 🔍 显示详情:', itemName);
            
            this.showNotification(`📖 正在查看${itemName}的详细信息`, 'info');
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 显示详情失败:', error);
        }
    }

    /**
     * 📋 切换展开/收起状态
     */
    toggleExpansion(button, container) {
        try {
            const isExpanded = button.textContent.includes('收起');
            const newText = isExpanded ? '展开' : '收起';
            const newIcon = isExpanded ? '▼' : '▲';
            
            button.textContent = newText;
            console.log('[MessageInfoBarRenderer] 📋 切换展开状态:', newText);
            
            this.showNotification(`${newIcon} ${newText}内容`, 'info');
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 切换展开状态失败:', error);
        }
    }

    /**
     * 🎨 提供按钮视觉反馈
     */
    provideButtonFeedback(button) {
        try {
            // 添加点击动画效果
            button.style.transform = 'scale(0.95)';
            button.style.transition = 'transform 0.1s ease';
            
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 100);
            
            // 临时高亮效果
            const originalBackground = button.style.background;
            button.style.background = 'rgba(0, 123, 255, 0.2)';
            
            setTimeout(() => {
                button.style.background = originalBackground;
            }, 300);
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 提供按钮反馈失败:', error);
        }
    }

    /**
     * ❓ 处理未知按钮点击
     */
    handleUnknownButtonClick(button, messageId, container) {
        try {
            const buttonText = button.textContent?.trim() || '未知按钮';
            console.log('[MessageInfoBarRenderer] ❓ 处理未知按钮:', buttonText);
            
            // 提供通用反馈
            this.showNotification(`🎯 ${buttonText} 功能已被触发`, 'info');
            this.provideButtonFeedback(button);
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理未知按钮失败:', error);
        }
    }

    /**
     * 📢 显示通知消息
     */
    showNotification(message, type = 'info') {
        try {
            const colors = {
                'success': '#28a745',
                'info': '#17a2b8', 
                'warning': '#ffc107',
                'error': '#dc3545'
            };
            
            // 创建通知元素
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type] || colors.info};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-size: 14px;
                max-width: 300px;
                word-wrap: break-word;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // 自动消失
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
            
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 显示通知失败:', error);
        }
    }

    /**
     * 🔍 从上下文获取资源类型
     */
    getResourceTypeFromContext(button) {
        try {
            const context = button.closest('[data-resource-type]');
            return context?.getAttribute('data-resource-type') || '未知';
        } catch (error) {
            return '未知';
        }
    }

    /**
     * 🔍 从上下文获取物品名称
     */
    getItemNameFromContext(button) {
        try {
            const context = button.closest('[data-item-name]');
            return context?.getAttribute('data-item-name') || '物品';
        } catch (error) {
            return '物品';
        }
    }

    /**
     * 🚀 执行自定义HTML中的JavaScript代码
     */
    executeCustomHTMLScripts(shadowRoot) {
        try {
            console.log('[MessageInfoBarRenderer] 🚀 执行自定义HTML脚本...');

            // 查找所有script标签
            const scripts = shadowRoot.querySelectorAll('script');
            
            if (scripts.length === 0) {
                console.log('[MessageInfoBarRenderer] 📝 未找到脚本标签');
                return;
            }

            scripts.forEach((script, index) => {
                try {
                    console.log(`[MessageInfoBarRenderer] 📝 处理脚本 ${index + 1}/${scripts.length}`);

                    if (script.src) {
                        // 外部脚本 - 创建新脚本加载
                        const newScript = document.createElement('script');
                        newScript.src = script.src;
                        newScript.async = false;
                        document.head.appendChild(newScript);
                        console.log(`[MessageInfoBarRenderer] 📥 外部脚本已加载: ${script.src}`);
                    } else {
                        // 内联脚本 - 在Shadow DOM的上下文中执行
                        const scriptContent = script.textContent;
                        
                        if (scriptContent.trim()) {
                            // 🔧 在正确的上下文中执行脚本
                            this.executeScriptInShadowDOM(scriptContent, shadowRoot);
                            console.log(`[MessageInfoBarRenderer] ✅ 内联脚本 ${index + 1} 执行成功`);
                        }
                    }

                } catch (error) {
                    console.error(`[MessageInfoBarRenderer] ❌ 脚本 ${index + 1} 执行失败:`, error);
                }
            });

            console.log('[MessageInfoBarRenderer] 🎉 所有脚本处理完成');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 执行自定义HTML脚本失败:', error);
        }
    }

    /**
     * 🔧 在Shadow DOM中执行脚本
     */
    executeScriptInShadowDOM(scriptContent, shadowRoot) {
        try {
            console.log('[MessageInfoBarRenderer] 🚀 开始在Shadow DOM中执行脚本...');

            // 🎯 增强的执行环境：提供完整的DOM API和全局函数
            const executeInContext = new Function('shadowRoot', 'document', 'window', 'SillyTavern', 'getVariables', 'triggerSlash', `
                // 🔧 重写DOM查询方法，使其指向shadowRoot
                const getElementById = (id) => shadowRoot.getElementById(id) || shadowRoot.querySelector('#' + id);
                const querySelector = (selector) => shadowRoot.querySelector(selector);
                const querySelectorAll = (selector) => shadowRoot.querySelectorAll(selector);
                const getElementsByClassName = (className) => shadowRoot.querySelectorAll('.' + className);
                const getElementsByTagName = (tagName) => shadowRoot.querySelectorAll(tagName);
                
                // 🎮 创建用户自定义HTML模板需要的全局对象
                const shadowDocument = {
                    getElementById: getElementById,
                    querySelector: querySelector,
                    querySelectorAll: querySelectorAll,
                    getElementsByClassName: getElementsByClassName,
                    getElementsByTagName: getElementsByTagName,
                    createElement: (tag) => document.createElement(tag),
                    addEventListener: (event, handler, options) => shadowRoot.addEventListener(event, handler, options),
                    body: shadowRoot,
                    head: shadowRoot
                };

                // 🔄 重写document引用，使用shadowRoot作为文档根节点
                const originalDocument = document;
                document = shadowDocument;
                
                // 📦 提供常用的全局函数
                const alert = window.alert;
                const console = window.console;
                const setTimeout = window.setTimeout;
                const setInterval = window.setInterval;
                const requestAnimationFrame = window.requestAnimationFrame;
                const fetch = window.fetch;
                
                // 🎯 提供SillyTavern特定的API
                const getVariablesSafe = getVariables || (() => Promise.resolve({}));
                const triggerSlashSafe = triggerSlash || ((cmd) => console.log('triggerSlash not available:', cmd));

                try {
                    // 🚀 执行用户脚本
                    ${scriptContent}
                    
                    console.log('[ShadowDOM Script] ✅ 脚本执行成功');
                    
                } catch (error) {
                    console.error('[ShadowDOM Script] ❌ 脚本执行错误:', error);
                    throw error;
                } finally {
                    // 恢复原始document
                    document = originalDocument;
                }
            `);

            // 🚀 在增强的上下文中执行脚本
            executeInContext.call(null, 
                shadowRoot, 
                shadowRoot.ownerDocument || document, 
                window,
                window.SillyTavern || {},
                window.getVariables,
                window.triggerSlash
            );

            console.log('[MessageInfoBarRenderer] ✅ Shadow DOM脚本执行完成');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ Shadow DOM脚本执行失败:', error);
            
            // 🔄 增强的备用方案：使用全局上下文但提供Shadow DOM上下文
            try {
                console.warn('[MessageInfoBarRenderer] ⚠️ 尝试增强备用脚本执行方案...');
                
                // 在全局上下文中创建临时的shadowRoot引用
                const originalGetElementById = document.getElementById;
                const originalQuerySelector = document.querySelector;
                const originalQuerySelectorAll = document.querySelectorAll;
                
                // 临时重写全局DOM方法
                document.getElementById = (id) => shadowRoot.getElementById(id) || shadowRoot.querySelector('#' + id) || originalGetElementById.call(document, id);
                document.querySelector = (selector) => shadowRoot.querySelector(selector) || originalQuerySelector.call(document, selector);
                document.querySelectorAll = (selector) => {
                    const shadowResult = shadowRoot.querySelectorAll(selector);
                    const documentResult = originalQuerySelectorAll.call(document, selector);
                    return shadowResult.length > 0 ? shadowResult : documentResult;
                };
                
                // 提供shadowRoot全局引用
                window.shadowRootContext = shadowRoot;
                
                try {
                    // 执行脚本
                    eval(`
                        (function() {
                            const shadowRoot = window.shadowRootContext;
                            ${scriptContent}
                        })();
                    `);
                    
                    console.log('[MessageInfoBarRenderer] ✅ 备用脚本执行成功');
                    
                } finally {
                    // 恢复原始DOM方法
                    document.getElementById = originalGetElementById;
                    document.querySelector = originalQuerySelector;
                    document.querySelectorAll = originalQuerySelectorAll;
                    delete window.shadowRootContext;
                }
                
            } catch (fallbackError) {
                console.error('[MessageInfoBarRenderer] ❌ 备用脚本执行也失败:', fallbackError);
                
                // 🔧 最终备用方案：直接在全局执行但记录shadowRoot
                try {
                    window.currentShadowRoot = shadowRoot;
                    eval(scriptContent);
                    console.log('[MessageInfoBarRenderer] ⚠️ 最终备用方案执行完成');
                } catch (finalError) {
                    console.error('[MessageInfoBarRenderer] ❌ 所有脚本执行方案均失败:', finalError);
                } finally {
                    delete window.currentShadowRoot;
                }
            }
        }
    }

    /**
     * 🎬 处理自定义动作
     */
    handleCustomAction(action, messageId, element, container) {
        try {
            console.log('[MessageInfoBarRenderer] 🎬 处理自定义动作:', action);

            switch (action) {
                case 'toggle-panel':
                    const panelId = element.getAttribute('data-panel-id');
                    if (panelId) {
                        this.togglePanel(panelId, container);
                    }
                    break;
                case 'refresh-data':
                    this.refreshInfoBarData(messageId);
                    break;
                case 'export-data':
                    this.exportInfoBarData(messageId);
                    break;
                case 'edit-data':
                    this.editInfoBarData(messageId);
                    break;
                default:
                    console.warn('[MessageInfoBarRenderer] ⚠️ 未知的自定义动作:', action);
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 处理自定义动作失败:', error);
        }
    }

    /**
     * 🔧 简化的自定义HTML缩放逻辑 - 修复显示不全问题
     */
    applyCustomHTMLScaling(container, wrapper, root, inner) {
        if (!container || !wrapper || !root || !inner) return;

        console.log('[MessageInfoBarRenderer] 🎯 开始简化缩放逻辑...');

        const containerWidth = container.clientWidth || 0;
        if (containerWidth <= 0) return;

        // 🔧 重置所有样式，获取自然尺寸
        inner.style.transform = 'none';
        inner.style.width = 'auto';
        inner.style.height = 'auto';

        // 强制重新布局
        inner.offsetHeight;

        const naturalWidth = inner.scrollWidth || inner.offsetWidth || 0;
        const naturalHeight = inner.scrollHeight || inner.offsetHeight || 0;

        console.log('[MessageInfoBarRenderer] 📏 尺寸信息:', {
            容器宽度: containerWidth,
            内容自然宽度: naturalWidth,
            内容自然高度: naturalHeight
        });

        if (naturalWidth <= 0 || naturalHeight <= 0) return;

        // 🎯 简单的缩放策略：只考虑宽度适配
        let scale = 1.0;

        if (naturalWidth > containerWidth) {
            // 内容过宽，需要缩放
            scale = (containerWidth - 20) / naturalWidth; // 留20px边距
            console.log('[MessageInfoBarRenderer] 📐 内容过宽，计算缩放比例:', scale.toFixed(3));
        } else {
            // 内容宽度合适，保持原始大小
            console.log('[MessageInfoBarRenderer] ✅ 内容宽度合适，保持原始大小');
        }

        // 🔧 限制缩放范围，避免过小或过大
        scale = Math.max(0.3, Math.min(1.0, scale));

        // 应用缩放
        inner.style.transform = `scale(${scale})`;
        inner.style.transformOrigin = 'top left';

        // 🎯 设置容器样式，确保内容完全显示
        wrapper.style.width = '100%';
        wrapper.style.height = 'auto';
        wrapper.style.maxHeight = 'none';
        wrapper.style.overflow = 'visible';

        // 🔧 调整容器高度以适应缩放后的内容
        const scaledHeight = naturalHeight * scale;
        wrapper.style.minHeight = scaledHeight + 'px';

        console.log('[MessageInfoBarRenderer] ✅ 缩放应用完成:', {
            最终缩放比例: scale.toFixed(3),
            缩放后高度: scaledHeight.toFixed(1) + 'px'
        });
    }

    /**
     * 绑定信息栏事件
     */
    bindInfoBarEvents(container) {
        try {
            if (!container) return;

            console.log('[MessageInfoBarRenderer] 🔗 开始绑定信息栏事件');

            // 绑定面板标题点击事件
            const panelHeaders = container.querySelectorAll('.infobar-panel-header');
            panelHeaders.forEach(header => {
                header.style.cursor = 'pointer';
                header.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const panel = header.closest('.infobar-panel');
                    if (panel) {
                        const content = panel.querySelector('.infobar-panel-content');
                        const arrow = panel.querySelector('.infobar-panel-arrow');

                        if (content) {
                            const isVisible = content.style.display !== 'none';

                            if (isVisible) {
                                content.style.display = 'none';
                                content.classList.remove('expanded');
                                if (arrow) arrow.textContent = '▶';
                            } else {
                                content.style.display = 'block';
                                content.classList.add('expanded');
                                if (arrow) arrow.textContent = '▼';
                            }

                            console.log('[MessageInfoBarRenderer] 🔄 面板切换:', header.getAttribute('data-panel'));
                        }
                    }
                });
            });

            // 绑定NPC选择器事件
            const npcSelector = container.querySelector('.infobar-npc-selector');
            if (npcSelector) {
                npcSelector.addEventListener('change', function() {
                    const selectedNpcId = this.value;
                    console.log('[MessageInfoBarRenderer] 🔄 NPC选择器变更:', selectedNpcId);

                    // 隐藏所有NPC详情面板
                    const allNpcDetails = container.querySelectorAll('.infobar-npc-details');
                    allNpcDetails.forEach(detail => {
                        detail.style.display = 'none';
                    });

                    // 显示选中的NPC详情面板
                    const selectedDetail = container.querySelector(`.infobar-npc-details[data-npc-id="${selectedNpcId}"]`);
                    if (selectedDetail) {
                        selectedDetail.style.display = 'block';
                        console.log('[MessageInfoBarRenderer] ✅ 已切换到NPC:', selectedNpcId);
                    }
                });
            }

            // 绑定组织选择器事件
            const orgSelector = container.querySelector('.infobar-org-selector');
            if (orgSelector) {
                orgSelector.addEventListener('change', function() {
                    const selectedOrgId = this.value;
                    console.log('[MessageInfoBarRenderer] 🔄 组织选择器变更:', selectedOrgId);

                    // 隐藏所有组织详情面板
                    const allOrgDetails = container.querySelectorAll('.infobar-org-details');
                    allOrgDetails.forEach(detail => {
                        detail.style.display = 'none';
                    });

                    // 显示选中的组织详情面板
                    const selectedDetail = container.querySelector(`.infobar-org-details[data-org-id="${selectedOrgId}"]`);
                    if (selectedDetail) {
                        selectedDetail.style.display = 'block';
                        console.log('[MessageInfoBarRenderer] ✅ 已切换到组织:', selectedOrgId);
                    }
                });
            }

            // 🆕 绑定多行数据选择器事件
            const rowSelectors = container.querySelectorAll('.infobar-row-selector');
            rowSelectors.forEach(selector => {
                selector.addEventListener('change', function() {
                    const selectedRowIndex = this.value;
                    const panelKey = this.getAttribute('data-panel');
                    console.log(`[MessageInfoBarRenderer] 🔄 行选择器变更: 面板=${panelKey}, 行=${selectedRowIndex}`);

                    // 隐藏该面板的所有行详情
                    const allRowDetails = container.querySelectorAll(`.infobar-row-details[data-panel="${panelKey}"]`);
                    allRowDetails.forEach(detail => {
                        detail.style.display = 'none';
                    });

                    // 显示选中的行详情
                    const selectedDetail = container.querySelector(`.infobar-row-details[data-panel="${panelKey}"][data-row-index="${selectedRowIndex}"]`);
                    if (selectedDetail) {
                        selectedDetail.style.display = 'block';
                        console.log(`[MessageInfoBarRenderer] ✅ 已切换到行: 面板=${panelKey}, 行=${selectedRowIndex}`);
                    }
                });
            });

            console.log('[MessageInfoBarRenderer] ✅ 信息栏事件绑定完成');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 绑定信息栏事件失败:', error);
        }
    }

    /**
     * 加载当前主题
     */
    async loadCurrentTheme() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            if (configs.theme && configs.theme.current) {
                const themeId = configs.theme.current;
                const theme = this.getThemeById(themeId);
                if (theme) {
                    this.currentTheme = {
                        themeId: themeId,
                        colors: theme.colors
                    };
                    console.log('[MessageInfoBarRenderer] 🎨 加载主题:', themeId);
                }
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 加载当前主题失败:', error);
        }
    }

    /**
     * 过滤系统字段
     */
    filterSystemFields(data) {
        try {
            if (!data || typeof data !== 'object') {
                return data;
            }

            const filtered = {};
            for (const [key, value] of Object.entries(data)) {
                // 跳过系统字段
                if (!this.SYSTEM_FIELDS.has(key)) {
                    filtered[key] = value;
                }
            }

            return filtered;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 过滤系统字段失败:', error);
            return data;
        }
    }

    /**
     * 检查是否为自定义API模式
     */
    async isCustomAPIMode() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            const apiConfig = configs.apiConfig || {};

            // 检查自定义API是否启用且配置完整
            const isEnabled = apiConfig.enabled === true;
            const hasApiKey = apiConfig.apiKey && apiConfig.apiKey.trim() !== '';
            const hasModel = apiConfig.model && apiConfig.model.trim() !== '';

            const isCustomAPIMode = isEnabled && hasApiKey && hasModel;

            console.log('[MessageInfoBarRenderer] 🔍 自定义API模式检测:', {
                enabled: isEnabled,
                hasApiKey: hasApiKey,
                hasModel: hasModel,
                provider: apiConfig.provider,
                isCustomAPIMode: isCustomAPIMode
            });

            return isCustomAPIMode;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 检查自定义API模式失败:', error);
            return false; // 出错时默认为主API模式
        }
    }

    /**
     * 检查前端显示功能是否启用
     */
    async isFrontendDisplayEnabled() {
        try {
            // 优先检查内部标志
            if (this.frontendDisplayMode) {
                console.log('[MessageInfoBarRenderer] 🔍 内部标志显示前端显示模式已启用');
                return true;
            }

            // 从配置管理器检查前端显示状态
            if (this.configManager) {
                const frontendDisplayConfig = await this.configManager.getFrontendDisplayConfig();
                const isEnabled = frontendDisplayConfig?.enabled === true;
                console.log('[MessageInfoBarRenderer] 🔍 配置管理器前端显示状态:', isEnabled);

                // 同步内部标志
                if (isEnabled !== this.frontendDisplayMode) {
                    this.frontendDisplayMode = isEnabled;
                    console.log('[MessageInfoBarRenderer] 🔄 已同步内部前端显示标志为' + isEnabled);
                }

                return isEnabled;
            }

            // 备用方案：直接从扩展设置检查
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            const isEnabled = configs.frontendDisplay?.enabled === true;
            console.log('[MessageInfoBarRenderer] 🔍 扩展设置前端显示状态:', isEnabled);

            // 同步内部标志
            if (isEnabled !== this.frontendDisplayMode) {
                this.frontendDisplayMode = isEnabled;
                console.log('[MessageInfoBarRenderer] 🔄 已同步内部前端显示标志为' + isEnabled);
            }

            return isEnabled;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 检查前端显示状态失败:', error);
            return this.frontendDisplayMode; // 出错时返回内部标志状态
        }
    }

    /**
     * 检查信息栏是否启用
     */
    async isInfoBarEnabled() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 🔧 修复：检查插件是否启用
            const basicSettings = configs.basic || {};
            const integrationSystemSettings = basicSettings.integrationSystem || {};
            const isPluginEnabled = integrationSystemSettings.enabled !== false; // 默认启用，除非明确设置为false

            // 🔧 新增：检查"在聊天中渲染信息栏"设置
            const renderInChatSettings = basicSettings.renderInChat || {};
            const isRenderInChatEnabled = renderInChatSettings.enabled !== false; // 默认启用，除非明确设置为false

            console.log('[MessageInfoBarRenderer] 🔍 启用状态检查:', {
                pluginEnabled: isPluginEnabled,
                renderInChatEnabled: isRenderInChatEnabled,
                finalResult: isPluginEnabled && isRenderInChatEnabled
            });

            // 只有当插件启用且允许在聊天中渲染时，才返回true
            return isPluginEnabled && isRenderInChatEnabled;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 检查启用状态失败:', error);
            return true; // 出错时默认启用
        }
    }

    /**
     * 检查信息栏是否默认折叠
     */
    async isDefaultCollapsed() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 检查基础设置中的默认折叠状态
            const defaultCollapsed = configs.basic?.defaultCollapsed?.enabled === true;
            console.log('[MessageInfoBarRenderer] 🔍 基础设置配置:', configs.basic?.defaultCollapsed);
            console.log('[MessageInfoBarRenderer] 🔍 默认折叠状态:', defaultCollapsed);

            return defaultCollapsed; // 默认展开，除非明确设置为true

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 检查默认折叠状态失败:', error);
            return false; // 出错时默认展开
        }
    }

    /**
     * 获取启用的面板配置
     * 🔧 修复：优先从DataTable获取最新配置，避免使用extensionSettings中的旧配置
     */
    getEnabledPanels() {
        try {
            // 🔧 关键修复：优先从DataTable获取最新的面板配置
            const dataTable = window.SillyTavernInfobar?.modules?.dataTable;
            if (dataTable && typeof dataTable.getAllEnabledPanels === 'function') {
                try {
                    const dataTablePanels = dataTable.getAllEnabledPanels();
                    
                    // DataTable返回的是数组，需要转换为对象格式
                    if (Array.isArray(dataTablePanels)) {
                        const enabledPanels = {};
                        dataTablePanels.forEach(panel => {
                            if (panel && panel.id) {
                                enabledPanels[panel.id] = panel;
                                // 也使用key作为索引（如果存在）
                                if (panel.key) {
                                    enabledPanels[panel.key] = panel;
                                }
                            }
                        });
                        console.log('[MessageInfoBarRenderer] ✅ 从DataTable获取到最新面板配置，面板数量:', dataTablePanels.length);
                        return enabledPanels;
                    } else if (dataTablePanels && typeof dataTablePanels === 'object') {
                        console.log('[MessageInfoBarRenderer] ✅ 从DataTable获取到最新面板配置（对象格式）');
                        return dataTablePanels;
                    }
                } catch (dataTableError) {
                    console.warn('[MessageInfoBarRenderer] ⚠️ 从DataTable获取配置失败:', dataTableError);
                }
            }

            // 🔧 备用方案：从extensionSettings读取（旧逻辑）
            console.warn('[MessageInfoBarRenderer] ⚠️ DataTable不可用，使用extensionSettings配置（可能不是最新）');
            
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            const enabledPanels = {};

            // 🔧 新架构：统一从customPanels获取所有面板
            const customPanels = configs.customPanels || {};
            
            Object.entries(customPanels).forEach(([panelKey, panel]) => {
                if (panel && panel.enabled !== false) {
                    enabledPanels[panelKey] = panel;
                }
            });

            return enabledPanels;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 获取启用面板失败:', error);
            return {};
        }
    }

    /**
     * 检查是否有有效的面板数据
     */
    hasValidPanelData(panels, enabledPanels) {
        try {
            for (const panelKey of Object.keys(enabledPanels)) {
                if (panels[panelKey]) {
                    const panelData = panels[panelKey];
                    if (panelData && typeof panelData === 'object' && Object.keys(panelData).length > 0) {
                        const hasValidValues = Object.values(panelData).some(value =>
                            this.isValidDataValue(value)
                        );
                        if (hasValidValues) {
                            return true;
                        }
                    }
                }
            }
            return false;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 检查面板数据失败:', error);
            return false;
        }
    }

    /**
     * 验证数据值是否有效
     */
    isValidDataValue(value) {
        if (!value || value === null || value === undefined) {
            return false;
        }

        const strValue = String(value).trim().toLowerCase();

        if (strValue === '' || strValue === 'null' || strValue === 'undefined') {
            return false;
        }

        // 🔧 修复：与DataTable保持一致的无效占位符列表
        // 🆕 修复：移除"未知"/"unknown"和"无"/"none"，这些是有效的状态值，应该显示
        const invalidPlaceholders = [
            '待补全', '暂无', '缺失', '空', '无数据', '无信息',
            'null', 'undefined', 'missing', 'tbd', 'to be determined',
            'not mentioned', 'not specified', 'blank', 'empty', 'void', 'nil', 'na', 'n/a',
            '-', '—', '未提及', '未指定'
        ];

        return !invalidPlaceholders.includes(strValue);
    }

    /**
     * 🔧 获取启用字段集合（与数据表逻辑对齐）
     * 规则：仅当 subItem.enabled === true 时视为启用
     */
    getEnabledFieldSet(panelKey, panelConfig) {
        try {
            if (!panelConfig || !Array.isArray(panelConfig.subItems)) return null;
            const enabled = new Set();
            panelConfig.subItems.forEach((subItem, index) => {
                if (subItem && subItem.enabled === true) {
                    const nameKey = subItem.name || subItem.key;
                    if (nameKey) enabled.add(String(nameKey));
                    // 支持 col_X 字段（自定义/信息面板）
                    enabled.add(`col_${index + 1}`);
                    if (subItem.key && subItem.key !== subItem.name) {
                        enabled.add(String(subItem.key));
                    }
                }
            });
            return enabled;
        } catch (error) {
            console.warn('[MessageInfoBarRenderer] ⚠️ 获取启用字段集合失败:', error);
            return null;
        }
    }

    /**
     * 🔧 判断字段是否启用
     */
    isFieldEnabled(panelKey, fieldName, panelConfig) {
        try {
            const enabledSet = this.getEnabledFieldSet(panelKey, panelConfig);

            // 🔧 新增：若字段不在配置子项列表中，则默认显示（避免新增列被意外隐藏）
            const subItems = Array.isArray(panelConfig?.subItems) ? panelConfig.subItems : [];
            if (subItems.length === 0) return true; // 无配置则不过滤

            const allSet = new Set();
            subItems.forEach((subItem, index) => {
                if (!subItem) return;
                if (subItem.name) allSet.add(String(subItem.name));
                if (subItem.key) allSet.add(String(subItem.key));
                allSet.add(`col_${index + 1}`);
            });

            const standardName = this.convertColFieldToStandardName(fieldName, panelKey);

            // 🛡️ 强制保障：个人信息面板中的“姓名”永不被误隐藏（支持 name/姓名/col_1 任一形式）
            if (panelKey === 'personal') {
                const cand = [String(fieldName || ''), String(standardName || '')];
                if (cand.includes('name') || cand.includes('姓名') || cand.includes('col_1')) {
                    return true;
                }
            }

            const isKnownField = allSet.has(fieldName) || allSet.has(standardName);

            if (!isKnownField) {
                // 新增未配置的字段：默认显示
                return true;
            }

            // 对已配置字段，遵循启用集合
            if (!enabledSet || enabledSet.size === 0) return true;
            if (enabledSet.has(fieldName) || (standardName && enabledSet.has(standardName))) return true;

            return false;
        } catch (error) {
            console.warn('[MessageInfoBarRenderer] ⚠️ 判断字段是否启用失败:', error);
            return true;
        }
    }

    /**
     * 🔧 重构：获取面板信息（动态从customPanels获取）
     */
    getPanelInfo(panelKey) {
        try {
            // 从customPanels动态获取面板信息
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (context && context.extensionSettings) {
                const customPanels = context.extensionSettings['Information bar integration tool']?.customPanels || {};
                const panel = customPanels[panelKey];
                
                if (panel) {
                    return {
                        name: panel.name || panelKey,
                        icon: panel.icon || 'fa-solid fa-folder'
                    };
                }
            }
        } catch (error) {
            console.warn('[MessageInfoBarRenderer] 获取面板信息失败:', error);
        }
        
        // 回退：返回键名本身
        return { name: panelKey, icon: 'fa-solid fa-info' };
    }

    /**
     * 按组织分组数据 - 用于处理多组织架构面板数据
     */
    groupOrgData(organizationData) {
        const orgGroups = {};
        const globalFields = {}; // 存储全局字段

        console.log('[MessageInfoBarRenderer] 🔍 开始组织数据分组，原始字段数:', Object.keys(organizationData).length);

        // 第一遍：收集所有组织特定字段和全局字段
        Object.entries(organizationData).forEach(([key, value]) => {
            const match = key.match(/^(org\d+)\.(.+)$/);
            if (match) {
                const [, orgId, fieldName] = match;
                if (!orgGroups[orgId]) {
                    orgGroups[orgId] = {};
                }
                orgGroups[orgId][fieldName] = value;
                console.log(`[MessageInfoBarRenderer] 📝 组织字段: ${orgId}.${fieldName} = ${value}`);
            } else {
                // 全局字段，稍后分配
                globalFields[key] = value;
                console.log(`[MessageInfoBarRenderer] 🌐 全局字段: ${key} = ${value}`);
            }
        });

        // 第二遍：将全局字段分配给所有组织（如果组织没有对应的特定字段）
        const orgIds = Object.keys(orgGroups);
        if (orgIds.length === 0) {
            // 如果没有组织特定字段，创建默认组织
            orgGroups['org0'] = {};
            orgIds.push('org0');
        }

        Object.entries(globalFields).forEach(([fieldName, value]) => {
            orgIds.forEach(orgId => {
                // 只有当组织没有这个字段时，才分配全局字段
                if (!orgGroups[orgId].hasOwnProperty(fieldName)) {
                    orgGroups[orgId][fieldName] = value;
                    console.log(`[MessageInfoBarRenderer] 🔄 分配全局字段到 ${orgId}.${fieldName} = ${value}`);
                }
            });
        });

        console.log('[MessageInfoBarRenderer] ✅ 组织数据分组完成:');
        Object.keys(orgGroups).forEach(orgId => {
            console.log(`[MessageInfoBarRenderer]   ${orgId}: ${Object.keys(orgGroups[orgId]).length} 个字段`);
        });

        return orgGroups;
    }

    /**
     * 获取组织显示名称
     */
    getOrgDisplayName(orgId, orgData) {
        if (orgData['组织名称'] && orgData['组织名称'] !== orgId && !orgData['组织名称'].includes('[需更新]')) {
            return orgData['组织名称'];
        } else if (orgData.name && orgData.name !== orgId && !orgData.name.includes('[需更新]')) {
            return orgData.name;
        } else if (orgData['组织类型'] && orgData['组织类型'] !== orgId && !orgData['组织类型'].includes('[需更新]')) {
            return orgData['组织类型'];
        } else if (orgId.match(/^org\d+$/i)) {
            const orgNum = orgId.replace(/^org/i, '');
            return `组织 ${orgNum}`;
        } else {
            return orgId;
        }
    }

    /**
     * 按NPC分组数据 - 修复版本
     */
    groupNpcData(interactionData) {
        const npcGroups = {};
        const globalFields = {}; // 存储全局字段

        console.log('[MessageInfoBarRenderer] 🔍 开始NPC数据分组，原始字段数:', Object.keys(interactionData).length);

        // 第一遍：收集所有NPC特定字段和全局字段
        Object.entries(interactionData).forEach(([key, value]) => {
            const match = key.match(/^(npc\d+)\.(.+)$/);
            if (match) {
                const [, npcId, fieldName] = match;
                if (!npcGroups[npcId]) {
                    npcGroups[npcId] = {};
                }
                npcGroups[npcId][fieldName] = value;
                console.log(`[MessageInfoBarRenderer] 📝 NPC字段: ${npcId}.${fieldName} = ${value}`);
            } else {
                // 全局字段，稍后分配
                globalFields[key] = value;
                console.log(`[MessageInfoBarRenderer] 🌐 全局字段: ${key} = ${value}`);
            }
        });

        // 第二遍：将全局字段分配给所有NPC（如果NPC没有对应的特定字段）
        const npcIds = Object.keys(npcGroups);
        if (npcIds.length === 0) {
            // 如果没有NPC特定字段，创建默认NPC
            npcGroups['npc0'] = {};
            npcIds.push('npc0');
        }

        Object.entries(globalFields).forEach(([fieldName, value]) => {
            npcIds.forEach(npcId => {
                // 只有当NPC没有这个字段时，才分配全局字段
                if (!npcGroups[npcId].hasOwnProperty(fieldName)) {
                    npcGroups[npcId][fieldName] = value;
                    console.log(`[MessageInfoBarRenderer] 🔄 分配全局字段到 ${npcId}.${fieldName} = ${value}`);
                }
            });
        });

        console.log('[MessageInfoBarRenderer] ✅ NPC数据分组完成:');
        Object.keys(npcGroups).forEach(npcId => {
            console.log(`[MessageInfoBarRenderer]   ${npcId}: ${Object.keys(npcGroups[npcId]).length} 个字段`);
        });

        return npcGroups;
    }

    /**
     * 从面板配置中获取字段显示名称
     */
    getFieldDisplayNameFromConfig(panelKey, fieldName, panelConfig) {
        try {
            // 🔧 新增：仅对“自定义面板”应用 col_X -> subItems 的快速映射，
            // 避免覆盖标准面板（personal/tasks 等）的标准字段名，导致“前置字段”或“1”之类的错误标签
            const standardPanels = [
                'personal', 'world', 'interaction', 'inventory', 'abilities',
                'tasks', 'organization', 'news', 'plot', 'cultivation',
                'fantasy', 'modern', 'historical', 'magic', 'training'
            ];
            const isStandardPanel = standardPanels.includes((panelKey || '').toLowerCase());

            // 🔧 修复：自定义面板支持多种字段名格式（col_X、纯数字、字段key）
            if (!isStandardPanel && panelConfig && panelConfig.subItems) {
                let colIndex = -1;
                
                // 尝试1: col_X 格式
                const colMatch = fieldName.match(/^col_(\d+)$/);
                if (colMatch) {
                    colIndex = parseInt(colMatch[1]) - 1; // col_1对应索引0
                }
                
                // 尝试2: 纯数字格式（兼容预设常用格式）
                if (colIndex === -1 && fieldName.match(/^\d+$/)) {
                    colIndex = parseInt(fieldName) - 1; // "1"对应索引0
                }
                
                // 如果成功解析出列索引，从 subItems 获取显示名称
                if (colIndex >= 0 && colIndex < panelConfig.subItems.length) {
                    const subItem = panelConfig.subItems[colIndex];
                    if (subItem && (subItem.displayName || subItem.name)) {
                        const displayName = subItem.displayName || subItem.name;
                        console.log(`[MessageInfoBarRenderer] 🎯 自定义面板字段映射: ${fieldName} -> ${displayName} (索引: ${colIndex}, 面板: ${panelKey})`);
                        return displayName;
                    }
                }
            }

            // 首先尝试从传入的panelConfig中获取（原有逻辑）
            if (panelConfig && panelConfig.subItems) {
                const subItem = panelConfig.subItems.find(item =>
                    item.name === fieldName || item.key === fieldName
                );
                if (subItem && subItem.displayName) {
                    return subItem.displayName;
                }
            }

            // 如果传入的panelConfig没有找到，从扩展设置中获取
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 检查基础面板配置
            if (configs[panelKey] && configs[panelKey].subItems) {
                const subItem = configs[panelKey].subItems.find(item =>
                    item.name === fieldName || item.key === fieldName
                );
                if (subItem && subItem.displayName) {
                    return subItem.displayName;
                }
            }

            // 如果还是没找到，尝试从DataTable的映射表获取（保持一致性）
            return this.getDataTableDisplayName(panelKey, fieldName);

        } catch (error) {
            console.warn('[MessageInfoBarRenderer] ⚠️ 从配置获取字段显示名称失败:', error);
            return null;
        }
    }

    /**
     * 获取显示名称 - 使用统一的完整映射表
     */
    getDataTableDisplayName(panelType, key) {
        try {
            // 🔧 修复：使用InfoBarSettings的完整映射表，确保所有字段都有正确的中文显示
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;
            if (infoBarSettings) {
                const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();
                return completeMapping[panelType]?.[key] || null;
            }
            
            // 如果没有找到映射，返回null
            return null;
            
        } catch (error) {
            console.warn('[MessageInfoBarRenderer] ⚠️ 获取显示名称失败:', error);
            return null;
        }
    }

    /**
     * 🔧 新增：获取统一的字段显示名称 - 与DataTable保持一致
     */
    getUnifiedFieldDisplayName(fieldKey, panelType = null) {
        try {
            // 使用InfoBarSettings的完整映射表，确保所有字段都有正确的中文显示
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;
            if (infoBarSettings) {
                const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();
                
                // 如果指定了面板类型，优先从对应面板的映射中查找
                if (panelType && completeMapping[panelType] && completeMapping[panelType][fieldKey]) {
                    return completeMapping[panelType][fieldKey];
                }
                
                // 否则在所有面板映射中查找
                for (const [panelId, panelMapping] of Object.entries(completeMapping)) {
                    if (panelMapping[fieldKey]) {
                        return panelMapping[fieldKey];
                    }
                }
            }
            
            // 如果没有找到映射，返回null（由调用方处理备用逻辑）
            return null;
            
        } catch (error) {
            console.warn('[MessageInfoBarRenderer] ⚠️ 获取统一字段显示名称失败:', error);
            return null;
        }
    }

    /**
     * 🔧 新增：标准显示名称回退函数 - 确保基础字段有正确的中文显示
     */
    getStandardDisplayNameFallback(fieldKey, panelType = null) {
        try {
            // 基础字段的硬编码映射表，确保不会返回错误的字段名
            const standardMappings = {
                personal: {
                    'name': '姓名',
                    'age': '年龄', 
                    'gender': '性别',
                    'occupation': '职业',
                    'appearance': '外貌',
                    'personality': '性格'
                },
                world: {
                    'name': '世界名称',
                    'type': '世界类型',
                    'time': '时间设定',
                    'location': '地点',
                    'weather': '天气'
                },
                tasks: {
                    'creation': '任务创建',
                    'editing': '任务编辑',
                    'status': '状态管理',
                    'priority': '优先级'
                },
                interaction: {
                    'name': '对象名称',
                    'type': '对象类型',
                    'status': '当前状态',
                    'relationship': '关系类型',
                    'intimacy': '亲密度'
                }
            };

            // 优先从指定面板查找
            if (panelType && standardMappings[panelType] && standardMappings[panelType][fieldKey]) {
                console.log(`[MessageInfoBarRenderer] ✅ 标准回退映射: ${panelType}.${fieldKey} -> ${standardMappings[panelType][fieldKey]}`);
                return standardMappings[panelType][fieldKey];
            }

            // 在所有面板中查找
            for (const [panelId, mapping] of Object.entries(standardMappings)) {
                if (mapping[fieldKey]) {
                    console.log(`[MessageInfoBarRenderer] ✅ 跨面板回退映射: ${fieldKey} -> ${mapping[fieldKey]} (来自${panelId}面板)`);
                    return mapping[fieldKey];
                }
            }

            // 如果还是没有找到，返回null
            console.log(`[MessageInfoBarRenderer] ⚠️ 标准回退映射未找到: ${fieldKey} (面板: ${panelType})`);
            return null;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 获取标准显示名称回退失败:', error);
            return null;
        }
    }

    /**
     * 获取NPC显示名称
     */
    getNpcDisplayName(npcId, npcData) {
        if (npcData.姓名 && npcData.姓名 !== npcId && !npcData.姓名.includes('[需更新]')) {
            return npcData.姓名;
        } else if (npcData.name && npcData.name !== npcId && !npcData.name.includes('[需更新]')) {
            return npcData.name;
        } else if (npcId.match(/^npc\d+$/i)) {
            const npcNum = npcId.replace(/^npc/i, '');
            return `NPC ${npcNum}`;
        } else {
            return npcId;
        }
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 获取自定义面板
     */
    getCustomPanels(panels, enabledPanels) {
        const customPanels = [];
        const standardPanels = [
            'personal', 'world', 'interaction', 'inventory', 'abilities',
            'tasks', 'organization', 'news', 'plot', 'cultivation',
            'fantasy', 'modern', 'historical', 'magic', 'training'
        ];

        // 🔧 修复：支持自定义面板别名映射（configs.customPanels[*].key）
        const aliasMap = {};
        Object.entries(enabledPanels).forEach(([id, cfg]) => {
            if (cfg && typeof cfg === 'object') {
                const isStandard = standardPanels.includes((id || '').toLowerCase());
                const aliasKey = (cfg.key || '').toString().toLowerCase();
                if (!isStandard && aliasKey) {
                    aliasMap[aliasKey] = id; // 例如 key='nearby' -> id='test'
                }
            }
        });

        Object.entries(panels).forEach(([panelId, panelData]) => {
            const lower = (panelId || '').toLowerCase();
            if (standardPanels.includes(lower)) return;

            // 直接命中或通过别名解析到真实ID
            const resolvedId = enabledPanels[panelId]
                ? panelId
                : (aliasMap[lower] || null);

            if (resolvedId && enabledPanels[resolvedId]) {
                customPanels.push([resolvedId, panelData]);
            }
        });

        return customPanels;
    }

    /**
     * 渲染自定义面板
     */
    renderCustomPanel(panelId, panelData, panelConfig, globalDefaultCollapsed = false) {
        try {
            if (!panelData || Object.keys(panelData).length === 0) {
                return '';
            }

            // 🆕 优化：处理多行数据的选择框功能（与基础面板保持一致）
            if (Array.isArray(panelData)) {
                console.log(`[MessageInfoBarRenderer] 🔧 自定义面板数组处理: ${panelId}, 行数: ${panelData.length}`);
                if (panelData.length === 0) {
                    return '';
                }

                // 🆕 多行数据：自动添加选择框（与基础面板逻辑一致）
                if (panelData.length > 1) {
                    console.log(`[MessageInfoBarRenderer] 🆕 检测到自定义面板多行数据，生成选择框: ${panelId}`);
                    return this.renderMultiRowCustomPanel(panelId, panelData, panelConfig, globalDefaultCollapsed);
                }

                // 单行数据：直接使用第一行
                const processedData = panelData[0];
                console.log(`[MessageInfoBarRenderer] 🔧 自定义面板单行数据，取第一行:`, processedData);
                return this.renderSingleRowCustomPanel(panelId, processedData, panelConfig, globalDefaultCollapsed);
            } else {
                console.log(`[MessageInfoBarRenderer] 🔧 处理对象格式自定义面板数据: ${panelId}`);
                return this.renderSingleRowCustomPanel(panelId, panelData, panelConfig, globalDefaultCollapsed);
            }

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染自定义面板失败:', error);
            return '';
        }
    }

    /**
     * 🆕 渲染多行数据自定义面板（带选择框）
     */
    renderMultiRowCustomPanel(panelId, panelDataArray, panelConfig, globalDefaultCollapsed = false) {
        try {
            console.log(`[MessageInfoBarRenderer] 🆕 开始渲染多行数据自定义面板: ${panelId}, 行数: ${panelDataArray.length}`);

            const panelName = panelConfig?.name || panelId;
            const panelIcon = panelConfig?.icon || 'fa-solid fa-info';
            const defaultCollapsed = globalDefaultCollapsed || panelConfig?.defaultCollapsed || false;

            let html = `
                <div class="infobar-panel" data-panel="${panelId}">
                    <div class="infobar-panel-header">
                        <div class="infobar-panel-title">
                            <span class="infobar-panel-arrow">${defaultCollapsed ? '▶' : '▼'}</span>
                            <i class="${panelIcon}"></i> ${this.escapeHtml(panelName)}
                        </div>
                    </div>
                    <div class="infobar-panel-content ${defaultCollapsed ? '' : 'expanded'}"
                         style="display: ${defaultCollapsed ? 'none' : 'block'};">
            `;

            // 🆕 添加行选择器
            html += '<div class="infobar-row-selector-wrapper">';
            html += `<select class="infobar-row-selector" data-panel="${panelId}">`;

            // 生成选择器选项（使用每行第一列数据作为标题）
            panelDataArray.forEach((rowData, index) => {
                const rowTitle = this.generateRowTitle(rowData, index);
                console.log(`[MessageInfoBarRenderer] 🔍 生成自定义面板行标题 ${index}: ${rowTitle}`);
                html += `<option value="${index}" ${index === 0 ? 'selected' : ''}>${this.escapeHtml(rowTitle)}</option>`;
            });

            html += '</select></div>';

            // 🆕 为每行数据创建详情面板
            html += '<div class="infobar-row-details-container">';

            panelDataArray.forEach((rowData, index) => {
                const displayStyle = index === 0 ? 'block' : 'none';
                html += `<div class="infobar-row-details" data-panel="${panelId}" data-row-index="${index}" style="display: ${displayStyle};">`;

                // 渲染这一行的数据
                const rowHtml = this.renderCustomRowData(panelId, rowData, panelConfig);
                html += rowHtml;

                html += '</div>';
            });

            html += '</div>'; // 结束 row-details-container
            html += '</div>'; // 结束 panel-content
            html += '</div>'; // 结束 panel

            console.log(`[MessageInfoBarRenderer] ✅ 多行数据自定义面板渲染完成: ${panelId}`);
            return html;

        } catch (error) {
            console.error(`[MessageInfoBarRenderer] ❌ 渲染多行自定义面板失败: ${panelId}`, error);
            return '';
        }
    }

    /**
     * 🆕 渲染单行数据自定义面板
     */
    renderSingleRowCustomPanel(panelId, panelData, panelConfig, globalDefaultCollapsed = false) {
        try {
            // 🔧 特殊处理信息面板的数组数据
            let processedData;
            const isInfoPanel = this.isInfoPanel(panelId, panelConfig);
            if (isInfoPanel && Array.isArray(panelData)) {
                console.log('[MessageInfoBarRenderer] 🔍 开始处理自定义信息面板数组数据');
                console.log('[MessageInfoBarRenderer] 🔍 信息面板数组内容:', panelData);

                // 将数组数据转换为对象格式
                const convertedData = {};
                panelData.forEach((item, index) => {
                    console.log(`[MessageInfoBarRenderer] 🔧 处理数组项${index}:`, item, typeof item);

                    if (item && typeof item === 'object') {
                        // 如果数组元素是对象，将其字段合并到convertedData中
                        console.log(`[MessageInfoBarRenderer] 🔧 展开对象，键:`, Object.keys(item));
                        Object.entries(item).forEach(([key, value]) => {
                            if (!this.SYSTEM_FIELDS.has(key)) {
                                console.log(`[MessageInfoBarRenderer] 🔧 添加字段: ${key} = ${value}`);
                                convertedData[key] = value;
                            } else {
                                console.log(`[MessageInfoBarRenderer] 🔧 跳过系统字段: ${key}`);
                            }
                        });
                    } else {
                        // 如果数组元素是基本类型，使用索引作为字段名
                        const fieldMapping = this.mapColFieldToDisplayName(`col_${index + 1}`, panelId);
                        const fieldName = fieldMapping || `信息${index + 1}`;
                        console.log(`[MessageInfoBarRenderer] 🔧 添加基本类型: ${fieldName} = ${item}`);
                        convertedData[fieldName] = item;
                    }
                });

                console.log('[MessageInfoBarRenderer] 🔧 信息面板转换后数据:', convertedData);
                processedData = convertedData;
            } else {
                processedData = panelData;
            }

            // 过滤系统字段
            const filteredData = this.filterSystemFields(processedData);
            if (!filteredData || Object.keys(filteredData).length === 0) {
                return '';
            }

            const panelName = panelConfig?.name || panelId;
            const panelIcon = panelConfig?.icon || 'fa-solid fa-info';
            const defaultCollapsed = globalDefaultCollapsed || panelConfig?.defaultCollapsed || false;

            let html = `
                <div class="infobar-panel" data-panel="${panelId}">
                    <div class="infobar-panel-header">
                        <div class="infobar-panel-title">
                            <span class="infobar-panel-arrow">${defaultCollapsed ? '▶' : '▼'}</span>
                            <i class="${panelIcon}"></i> ${this.escapeHtml(panelName)}
                        </div>
                    </div>
                    <div class="infobar-panel-content ${defaultCollapsed ? '' : 'expanded'}"
                         style="display: ${defaultCollapsed ? 'none' : 'block'};">
            `;

            // 渲染面板项目
            const rowHtml = this.renderCustomRowData(panelId, filteredData, panelConfig);
            html += rowHtml;

            html += `</div></div>`;
            return html;

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染单行自定义面板失败:', error);
            return '';
        }
    }

    /**
     * 🆕 渲染自定义面板单行数据内容
     */
    renderCustomRowData(panelId, rowData, panelConfig) {
        try {
            const filteredData = this.filterSystemFields(rowData);
            if (!filteredData || Object.keys(filteredData).length === 0) {
                return '<div class="infobar-empty">暂无数据</div>';
            }

            let html = '';
            Object.entries(filteredData).forEach(([fieldName, value]) => {
                // 仅渲染启用字段
                if (!this.isFieldEnabled(panelId, fieldName, panelConfig)) return;
                if (this.isValidDataValue(value)) {
                    // 🔧 修复：对于自定义面板，使用完整的字段映射逻辑
                    let displayLabel = this.getFieldDisplayNameFromConfig(panelId, fieldName, panelConfig);
                    if (!displayLabel) {
                        // 🔧 新增：先将col_X格式转换为系统期望的字段名
                        const standardFieldName = this.convertColFieldToStandardName(fieldName, panelId);

                        // 优先使用InfoBarSettings的完整映射表（使用转换后的字段名）
                        displayLabel = this.getUnifiedFieldDisplayName(standardFieldName, panelId);
                        if (!displayLabel) {
                            // 备用：使用本地FIELD_LABELS映射表
                            displayLabel = this.FIELD_LABELS[standardFieldName] || this.FIELD_LABELS[fieldName];
                            if (!displayLabel) {
                                // 最后备用：使用我的字段映射
                                displayLabel = this.mapColFieldToDisplayName(fieldName, panelId) || fieldName;
                            }
                        }
                    }
                    console.log(`[MessageInfoBarRenderer] 🔍 自定义面板字段映射: ${fieldName} -> ${displayLabel} (面板: ${panelId})`);

                    html += `
                        <div class="infobar-item">
                            <span class="infobar-item-label">${this.escapeHtml(displayLabel)}:</span>
                            <span class="infobar-item-value">${this.escapeHtml(String(value))}</span>
                        </div>
                    `;
                }
            });

            return html || ''; // 🔧 修复：移除"暂无有效数据"提示，避免空数据时显示不必要的UI

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 渲染自定义面板行数据失败:', error);
            // 🔧 修复：不显示错误UI，避免插件禁用后无法清理的问题
            return '';
        }
    }

    /**
     * 应用当前主题到信息栏
     * 🔧 修复：增强主题应用的可靠性和调试信息
     */
    applyCurrentTheme(infoBarElement) {
        try {
            // 🔧 增强调试：详细记录主题状态
            if (!infoBarElement) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 信息栏元素为空，无法应用主题');
                return;
            }

            // 🔧 修复：跳过自定义HTML样式的容器，避免覆盖用户自定义CSS
            if (infoBarElement.classList.contains('infobar-style-custom-html')) {
                console.log('[MessageInfoBarRenderer] 🎨 跳过自定义HTML容器的主题应用，保留用户自定义样式');
                return;
            }

            if (!this.currentTheme) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 当前主题未加载，尝试重新加载主题...');
                // 🔧 修复：主题未加载时主动重新加载
                this.loadCurrentTheme().then(() => {
                    if (this.currentTheme) {
                        console.log('[MessageInfoBarRenderer] ✅ 主题重新加载成功，重新应用主题');
                        this.applyCurrentTheme(infoBarElement);
                    } else {
                        console.error('[MessageInfoBarRenderer] ❌ 主题重新加载失败，使用默认主题');
                        this.applyFallbackTheme(infoBarElement);
                    }
                });
                return;
            }

            const colors = this.currentTheme.colors;
            if (!colors) {
                console.warn('[MessageInfoBarRenderer] ⚠️ 主题颜色配置缺失，使用默认主题');
                this.applyFallbackTheme(infoBarElement);
                return;
            }

            // 应用主题CSS变量
            infoBarElement.style.setProperty('--infobar-bg', colors.bg);
            infoBarElement.style.setProperty('--infobar-text', colors.text);
            infoBarElement.style.setProperty('--infobar-border', colors.border);
            infoBarElement.style.setProperty('--infobar-hover', this.adjustColor(colors.bg, 10));
            infoBarElement.style.setProperty('--infobar-primary', colors.primary);
            infoBarElement.style.setProperty('--infobar-gradient-start', colors.primary);
            infoBarElement.style.setProperty('--infobar-gradient-end', this.adjustColor(colors.primary, -20));
            infoBarElement.style.setProperty('--infobar-header-text', '#ffffff');
            infoBarElement.style.setProperty('--infobar-shadow', 'rgba(0, 0, 0, 0.1)');

            console.log('[MessageInfoBarRenderer] 🎨 主题已应用到信息栏:', this.currentTheme.themeId);

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 应用主题失败:', error);
            // 🔧 修复：出错时使用默认主题
            this.applyFallbackTheme(infoBarElement);
        }
    }

    /**
     * 🔧 新增：应用默认回退主题
     */
    applyFallbackTheme(infoBarElement) {
        try {
            if (!infoBarElement) return;

            const fallbackColors = {
                bg: '#1a1a1a',
                text: '#ffffff', 
                primary: '#007bff',
                border: '#333'
            };

            infoBarElement.style.setProperty('--infobar-bg', fallbackColors.bg);
            infoBarElement.style.setProperty('--infobar-text', fallbackColors.text);
            infoBarElement.style.setProperty('--infobar-border', fallbackColors.border);
            infoBarElement.style.setProperty('--infobar-hover', this.adjustColor(fallbackColors.bg, 10));
            infoBarElement.style.setProperty('--infobar-primary', fallbackColors.primary);
            infoBarElement.style.setProperty('--infobar-gradient-start', fallbackColors.primary);
            infoBarElement.style.setProperty('--infobar-gradient-end', this.adjustColor(fallbackColors.primary, -20));
            infoBarElement.style.setProperty('--infobar-header-text', '#ffffff');
            infoBarElement.style.setProperty('--infobar-shadow', 'rgba(0, 0, 0, 0.1)');

            console.log('[MessageInfoBarRenderer] 🔧 已应用默认回退主题');
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 应用回退主题失败:', error);
        }
    }

    /**
     * 更新所有信息栏主题
     */
    updateAllInfoBarThemes() {
        try {
            const allInfoBars = document.querySelectorAll('.infobar-container');
            allInfoBars.forEach(infoBar => {
                this.applyCurrentTheme(infoBar);
            });

            console.log('[MessageInfoBarRenderer] 🎨 已更新所有信息栏主题');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 更新信息栏主题失败:', error);
        }
    }

    /**
     * 清理指定消息的信息栏元素
     */
    cleanupInfoBarForMessage(messageId) {
        try {
            let cleanedCount = 0;

            // 方法1: 清理消息内部的信息栏元素
            const messageElement = document.querySelector(`[mesid="${messageId}"]`);
            if (messageElement) {
                const infoBarsinMessage = messageElement.querySelectorAll('.infobar-container');
                infoBarsinMessage.forEach(infoBar => {
                    infoBar.remove();
                    cleanedCount++;
                });
                console.log('[MessageInfoBarRenderer] 🧹 从消息元素中清理了', infoBarsinMessage.length, '个信息栏');
            }

            // 方法2: 清理独立的浮动式/交互式信息栏（基于data-message-id属性）
            const independentInfoBars = document.querySelectorAll(`.infobar-container[data-message-id="${messageId}"]`);
            independentInfoBars.forEach(infoBar => {
                infoBar.remove();
                cleanedCount++;
            });
            if (independentInfoBars.length > 0) {
                console.log('[MessageInfoBarRenderer] 🧹 清理了', independentInfoBars.length, '个独立信息栏');
            }

            // 方法3: 清理可能的前端显示管理器包装器
            if (window.SillyTavernInfobar?.frontendDisplayManager) {
                try {
                    window.SillyTavernInfobar.frontendDisplayManager.removeMessageWrapper(messageId);
                    console.log('[MessageInfoBarRenderer] 🧹 清理了前端显示管理器包装器');
                } catch (error) {
                    console.warn('[MessageInfoBarRenderer] ⚠️ 清理前端显示管理器包装器失败:', error);
                }
            }

            console.log('[MessageInfoBarRenderer] 🧹 消息', messageId, '的信息栏清理完成，共清理', cleanedCount, '个元素');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 清理指定消息信息栏失败:', error);
        }
    }

    /**
     * 清理所有信息栏元素
     */
    cleanupAllInfoBars() {
        try {
            const allInfoBars = document.querySelectorAll('.infobar-container');
            let cleanedCount = 0;

            allInfoBars.forEach(infoBar => {
                infoBar.remove();
                cleanedCount++;
            });

            console.log('[MessageInfoBarRenderer] 🧹 已清理', cleanedCount, '个信息栏元素');

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 清理信息栏失败:', error);
        }
    }

    /**
     * 颜色调整工具
     */
    adjustColor(color, percent) {
        try {
            // 简单的颜色亮度调整
            const num = parseInt(color.replace("#", ""), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;

            return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);

        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 颜色调整失败:', error);
            return color;
        }
    }

    /**
     * 获取主题配置
     */
    getThemeById(themeId) {
        // 与DataTable和InfoBarSettings中的主题配置保持一致
        const themes = {
            'default-dark': {
                id: 'default-dark',
                name: '默认深色',
                colors: { bg: '#1a1a1a', text: '#ffffff', primary: '#007bff', border: '#333' }
            },
            'default-light': {
                id: 'default-light',
                name: '默认浅色',
                colors: { bg: '#ffffff', text: '#333333', primary: '#007bff', border: '#dee2e6' }
            },
            'ocean-blue': {
                id: 'ocean-blue',
                name: '海洋蓝',
                colors: { bg: '#0f1419', text: '#e6fffa', primary: '#00d4aa', border: '#1e3a8a' }
            },
            'forest-green': {
                id: 'forest-green',
                name: '森林绿',
                colors: { bg: '#0d1b0d', text: '#e8f5e8', primary: '#22c55e', border: '#166534' }
            },
            'sunset-orange': {
                id: 'sunset-orange',
                name: '日落橙',
                colors: { bg: '#1a0f0a', text: '#fff5e6', primary: '#ff8c00', border: '#cc6600' }
            },
            'royal-purple': {
                id: 'royal-purple',
                name: '皇家紫',
                colors: { bg: '#1a0d1a', text: '#f3e8ff', primary: '#a855f7', border: '#7c3aed' }
            },
            'crimson-red': {
                id: 'crimson-red',
                name: '深红',
                colors: { bg: '#1a0a0a', text: '#ffe6e6', primary: '#dc2626', border: '#b91c1c' }
            },
            'midnight-blue': {
                id: 'midnight-blue',
                name: '午夜蓝',
                colors: { bg: '#0a0f1a', text: '#e6f0ff', primary: '#3b82f6', border: '#1d4ed8' }
            },
            'emerald-green': {
                id: 'emerald-green',
                name: '翡翠绿',
                colors: { bg: '#0a1a0f', text: '#e6ffe6', primary: '#10b981', border: '#059669' }
            },
            'golden-yellow': {
                id: 'golden-yellow',
                name: '金黄',
                colors: { bg: '#1a1a0a', text: '#ffffe6', primary: '#f59e0b', border: '#d97706' }
            },
            'rose-pink': {
                id: 'rose-pink',
                name: '玫瑰粉',
                colors: { bg: '#1a0f14', text: '#ffe6f0', primary: '#ec4899', border: '#db2777' }
            },
            'steel-gray': {
                id: 'steel-gray',
                name: '钢灰',
                colors: { bg: '#0f0f0f', text: '#e6e6e6', primary: '#6b7280', border: '#4b5563' }
            },
            'copper-bronze': {
                id: 'copper-bronze',
                name: '青铜',
                colors: { bg: '#1a140a', text: '#fff0e6', primary: '#ea580c', border: '#c2410c' }
            },
            'lavender-purple': {
                id: 'lavender-purple',
                name: '薰衣草紫',
                colors: { bg: '#14101a', text: '#f0e6ff', primary: '#8b5cf6', border: '#7c3aed' }
            },
            'mint-green': {
                id: 'mint-green',
                name: '薄荷绿',
                colors: { bg: '#0a1a14', text: '#e6fff0', primary: '#06d6a0', border: '#059669' }
            },
            'cherry-blossom': {
                id: 'cherry-blossom',
                name: '樱花粉',
                colors: { bg: '#1a0f14', text: '#ffe6f0', primary: '#ff69b4', border: '#d1477a' }
            },
            'purple-night': {
                id: 'purple-night',
                name: '紫夜',
                colors: { bg: '#1a0d1a', text: '#f0e6ff', primary: '#9d4edd', border: '#6a1b9a' }
            },
            'golden-sand': {
                id: 'golden-sand',
                name: '金沙',
                colors: { bg: '#1a1a0d', text: '#fffacd', primary: '#ffd700', border: '#b8860b' }
            },
            'ice-blue': {
                id: 'ice-blue',
                name: '冰蓝',
                colors: { bg: '#0d1419', text: '#e6f7ff', primary: '#87ceeb', border: '#4682b4' }
            },
            'rose-red': {
                id: 'rose-red',
                name: '玫瑰红',
                colors: { bg: '#1a0d0f', text: '#ffe6ea', primary: '#dc143c', border: '#b91c3c' }
            },
            'lavender': {
                id: 'lavender',
                name: '薰衣草',
                colors: { bg: '#14101a', text: '#f0e6ff', primary: '#9370db', border: '#7b68ee' }
            },
            'coffee-brown': {
                id: 'coffee-brown',
                name: '咖啡棕',
                colors: { bg: '#1a140d', text: '#f5f0e6', primary: '#8b4513', border: '#a0522d' }
            },
            'coral-white': {
                id: 'coral-white',
                name: '珊瑚橙·雅韵',
                colors: { bg: '#fffaf7', text: '#2d1810', primary: '#ff7f50', border: '#ffcab0' }
            },
            'sky-white': {
                id: 'sky-white',
                name: '天空蓝·清韵',
                colors: { bg: '#f8fbff', text: '#0c2340', primary: '#4a90e2', border: '#b8d9f7' }
            },
            'jade-white': {
                id: 'jade-white',
                name: '翡翠绿·雅致',
                colors: { bg: '#f6fcfa', text: '#0f3a2e', primary: '#00a67e', border: '#99e6d4' }
            },
            'violet-white': {
                id: 'violet-white',
                name: '紫罗兰·优雅',
                colors: { bg: '#fcf8ff', text: '#3d1a5f', primary: '#8b5cf6', border: '#d8b4fe' }
            },
            'rose-white': {
                id: 'rose-white',
                name: '樱粉·柔美',
                colors: { bg: '#fff9fb', text: '#5c1a33', primary: '#e91e63', border: '#f8bbd0' }
            }
        };

        return themes[themeId] || themes['default-dark'];
    }

    /**
     * 🔧 判断是否为信息面板（通过面板名称或配置识别）
     */
    isInfoPanel(panelKey, panelConfig) {
        try {
            // 方法1: 通过面板键识别
            if (panelKey === 'info') {
                return true;
            }

            // 方法2: 通过面板配置识别
            if (panelConfig && panelConfig.name === '信息') {
                return true;
            }

            // 方法3: 通过数据表格配置识别
            const dataTable = window.SillyTavernInfobar?.modules?.dataTable;
            if (dataTable) {
                const enabledPanels = dataTable.getAllEnabledPanels();
                const infoPanel = enabledPanels.find(panel =>
                    panel.name === '信息' ||
                    (panel.key === undefined && panel.name === '信息') ||
                    panel.key === 'info'
                );

                if (infoPanel) {
                    // 如果找到信息面板配置，检查当前面板是否匹配
                    return (panelKey === infoPanel.key ||
                           (panelKey === undefined && infoPanel.key === undefined));
                }
            }

            return false;
        } catch (error) {
            console.error('[MessageInfoBarRenderer] ❌ 判断信息面板失败:', error);
            return false;
        }
    }

    /**
     * 获取渲染器状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            renderedMessagesCount: this.renderedMessages.size,
            currentTheme: this.currentTheme?.themeId || 'unknown'
        };
    }
}
