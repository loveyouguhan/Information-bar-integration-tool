/**
 * 预设面板管理器
 * 
 * 负责管理插件预设的面板配置：
 * - 15个预设面板的定义
 * - 预设面板的初始化
 * - 预设面板的恢复功能
 * - 预设面板的默认配置
 * 
 * @class PresetPanelsManager
 */

export class PresetPanelsManager {
    constructor() {
        console.log('[PresetPanelsManager] 🔧 预设面板管理器初始化');
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
    }

    /**
     * 获取所有预设面板配置
     * @returns {Object} 预设面板配置对象
     */
    static getPresets() {
        return {
            // ===== 1. 个人信息面板 =====
            'personal': {
                name: '个人信息',
                key: 'personal',
                id: 'personal',
                type: 'preset',
                icon: 'fa-solid fa-user',
                description: '记录角色的基本信息，如姓名、年龄、职业、性格等个人属性',
                enabled: true,
                subItems: [
                    // 基础信息（默认启用）
                    { name: '姓名', key: '姓名', enabled: true, type: 'text', required: true, description: '角色的名字' },
                    { name: '年龄', key: '年龄', enabled: true, type: 'number', description: '角色的年龄' },
                    { name: '性别', key: '性别', enabled: true, type: 'text', description: '角色的性别' },
                    { name: '职业', key: '职业', enabled: true, type: 'text', description: '角色的职业或身份' },
                    { name: '身高', key: '身高', enabled: false, type: 'text', description: '角色的身高' },
                    { name: '体重', key: '体重', enabled: false, type: 'text', description: '角色的体重' },
                    { name: '血型', key: '血型', enabled: false, type: 'text', description: '角色的血型' },
                    { name: '星座', key: '星座', enabled: false, type: 'text', description: '角色的星座' },
                    { name: '生日', key: '生日', enabled: false, type: 'date', description: '角色的生日' },
                    { name: '出生地', key: '出生地', enabled: false, type: 'text', description: '角色的出生地' },
                    { name: '国籍', key: '国籍', enabled: false, type: 'text', description: '角色的国籍' },
                    { name: '民族', key: '民族', enabled: false, type: 'text', description: '角色的民族' },
                    // 外观特征
                    { name: '发色', key: '发色', enabled: false, type: 'text', description: '头发颜色' },
                    { name: '发型', key: '发型', enabled: false, type: 'text', description: '发型样式' },
                    { name: '眼色', key: '眼色', enabled: false, type: 'text', description: '眼睛颜色' },
                    { name: '肤色', key: '肤色', enabled: false, type: 'text', description: '皮肤颜色' },
                    { name: '体型', key: '体型', enabled: false, type: 'text', description: '身材体型' },
                    { name: '面部特征', key: '面部特征', enabled: false, type: 'text', description: '面部特征描述' },
                    { name: '疤痕', key: '疤痕', enabled: false, type: 'text', description: '疤痕或伤痕' },
                    { name: '纹身', key: '纹身', enabled: false, type: 'text', description: '纹身图案' },
                    { name: '饰品', key: '饰品', enabled: false, type: 'text', description: '佩戴的饰品' },
                    { name: '服装风格', key: '服装风格', enabled: false, type: 'text', description: '穿衣风格' },
                    { name: '外观描述', key: '外观描述', enabled: true, type: 'text', description: '整体外观描述' },
                    { name: '声音特征', key: '声音特征', enabled: false, type: 'text', description: '声音特点' },
                    // 性格特质
                    { name: '性格', key: '性格', enabled: true, type: 'text', description: '性格特征' },
                    { name: '气质', key: '气质', enabled: false, type: 'text', description: '气质类型' },
                    { name: '态度', key: '态度', enabled: false, type: 'text', description: '行事态度' },
                    { name: '价值观', key: '价值观', enabled: false, type: 'text', description: '价值观念' },
                    { name: '信仰', key: '信仰', enabled: false, type: 'text', description: '宗教信仰' },
                    { name: '恐惧', key: '恐惧', enabled: false, type: 'text', description: '恐惧对象' },
                    { name: '梦想', key: '梦想', enabled: false, type: 'text', description: '梦想目标' },
                    { name: '目标', key: '目标', enabled: false, type: 'text', description: '当前目标' },
                    // 能力属性
                    { name: '智力', key: '智力', enabled: false, type: 'number', description: '智力属性' },
                    { name: '体力', key: '体力', enabled: false, type: 'number', description: '体力属性' },
                    { name: '魅力', key: '魅力', enabled: false, type: 'number', description: '魅力属性' },
                    { name: '运气', key: '运气', enabled: false, type: 'number', description: '运气属性' },
                    { name: '感知', key: '感知', enabled: false, type: 'number', description: '感知能力' },
                    { name: '意志力', key: '意志力', enabled: false, type: 'number', description: '意志力' },
                    { name: '反应速度', key: '反应速度', enabled: false, type: 'number', description: '反应速度' },
                    { name: '学习能力', key: '学习能力', enabled: false, type: 'number', description: '学习能力' },
                    // 社会关系
                    { name: '家庭背景', key: '家庭背景', enabled: false, type: 'text', description: '家庭出身' },
                    { name: '教育经历', key: '教育经历', enabled: false, type: 'text', description: '教育背景' },
                    { name: '工作经历', key: '工作经历', enabled: false, type: 'text', description: '工作经历' },
                    { name: '收入', key: '收入', enabled: false, type: 'text', description: '收入水平' },
                    { name: '社会地位', key: '社会地位', enabled: false, type: 'text', description: '社会地位' },
                    { name: '人际关系', key: '人际关系', enabled: false, type: 'text', description: '人际关系网' },
                    { name: '恋爱状态', key: '恋爱状态', enabled: false, type: 'text', description: '恋爱状况' },
                    { name: '婚姻状态', key: '婚姻状态', enabled: false, type: 'text', description: '婚姻状况' },
                    // 兴趣爱好
                    { name: '兴趣爱好', key: '兴趣爱好', enabled: false, type: 'text', description: '兴趣爱好' },
                    { name: '运动', key: '运动', enabled: false, type: 'text', description: '运动爱好' },
                    { name: '音乐', key: '音乐', enabled: false, type: 'text', description: '音乐喜好' },
                    { name: '艺术', key: '艺术', enabled: false, type: 'text', description: '艺术爱好' },
                    { name: '阅读', key: '阅读', enabled: false, type: 'text', description: '阅读喜好' },
                    { name: '游戏', key: '游戏', enabled: false, type: 'text', description: '游戏爱好' },
                    { name: '旅行', key: '旅行', enabled: false, type: 'text', description: '旅行经历' },
                    { name: '烹饪', key: '烹饪', enabled: false, type: 'text', description: '烹饪技能' },
                    { name: '技能特长', key: '技能特长', enabled: false, type: 'text', description: '特长技能' },
                    { name: '语言能力', key: '语言能力', enabled: false, type: 'text', description: '掌握的语言' },
                    { name: '生活习惯', key: '生活习惯', enabled: false, type: 'text', description: '生活习惯' },
                    { name: '健康状态', key: '健康状态', enabled: false, type: 'text', description: '健康状况' }
                ],
                prompts: {
                    init: '根据对话内容，提取角色的个人信息，如姓名、年龄、职业、性格等基本属性。',
                    insert: '从对话中识别出新的个人信息字段，添加到个人信息面板中。',
                    update: '当对话中提到角色的个人信息发生变化时，更新对应的字段内容。',
                    delete: '当角色的某个个人信息不再适用或需要移除时，删除该字段。'
                },
                order: 1
            },

            // ===== 2. 世界状态面板 =====
            'world': {
                name: '世界状态',
                key: 'world',
                id: 'world',
                type: 'preset',
                icon: 'fa-solid fa-globe',
                description: '记录世界观设定，如时代背景、地理位置、气候环境、社会制度等',
                enabled: true,
                subItems: [
                    // 基础设定（默认启用）
                    { name: '世界名称', key: '世界名称', enabled: true, type: 'text', description: '世界的名称' },
                    { name: '世界类型', key: '世界类型', enabled: true, type: 'text', description: '世界的类型' },
                    { name: '世界风格', key: '世界风格', enabled: true, type: 'text', description: '世界的风格' },
                    { name: '主题设定', key: '主题设定', enabled: false, type: 'text', description: '世界的主题' },
                    { name: '世界描述', key: '世界描述', enabled: true, type: 'text', description: '世界的描述' },
                    { name: '历史背景', key: '历史背景', enabled: false, type: 'text', description: '世界的历史' },
                    { name: '神话传说', key: '神话传说', enabled: false, type: 'text', description: '神话传说' },
                    { name: '世界观设定', key: '世界观设定', enabled: false, type: 'text', description: '世界观' },
                    // 地理环境
                    { name: '地理环境', key: '地理环境', enabled: true, type: 'text', description: '地理环境' },
                    { name: '气候条件', key: '气候条件', enabled: false, type: 'text', description: '气候条件' },
                    { name: '地形地貌', key: '地形地貌', enabled: false, type: 'text', description: '地形地貌' },
                    { name: '生态群落', key: '生态群落', enabled: false, type: 'text', description: '生态系统' },
                    { name: '重要地点', key: '重要地点', enabled: true, type: 'text', description: '重要地点' },
                    { name: '地标建筑', key: '地标建筑', enabled: false, type: 'text', description: '地标建筑' },
                    { name: '城市聚落', key: '城市聚落', enabled: false, type: 'text', description: '城市聚落' },
                    { name: '地下城', key: '地下城', enabled: false, type: 'text', description: '地下城' },
                    // 时间系统
                    { name: '时间系统', key: '时间系统', enabled: true, type: 'text', description: '时间系统' },
                    { name: '历法系统', key: '历法系统', enabled: false, type: 'text', description: '历法系统' },
                    { name: '季节变化', key: '季节变化', enabled: false, type: 'text', description: '季节变化' },
                    { name: '昼夜循环', key: '昼夜循环', enabled: false, type: 'text', description: '昼夜循环' },
                    { name: '天气系统', key: '天气系统', enabled: false, type: 'text', description: '天气系统' },
                    { name: '世界事件', key: '世界事件', enabled: false, type: 'text', description: '世界事件' },
                    { name: '节日庆典', key: '节日庆典', enabled: false, type: 'text', description: '节日庆典' },
                    { name: '自然灾害', key: '自然灾害', enabled: false, type: 'text', description: '自然灾害' },
                    // 社会文化
                    { name: '文化体系', key: '文化体系', enabled: false, type: 'text', description: '文化体系' },
                    { name: '语言系统', key: '语言系统', enabled: false, type: 'text', description: '语言系统' },
                    { name: '宗教信仰', key: '宗教信仰', enabled: false, type: 'text', description: '宗教信仰' },
                    { name: '风俗习惯', key: '风俗习惯', enabled: false, type: 'text', description: '风俗习惯' },
                    { name: '政治制度', key: '政治制度', enabled: false, type: 'text', description: '政治制度' },
                    { name: '经济体系', key: '经济体系', enabled: false, type: 'text', description: '经济体系' },
                    { name: '科技水平', key: '科技水平', enabled: false, type: 'text', description: '科技水平' },
                    { name: '魔法体系', key: '魔法体系', enabled: false, type: 'text', description: '魔法体系' },
                    // 生物种族
                    { name: '种族设定', key: '种族设定', enabled: false, type: 'text', description: '种族设定' },
                    { name: '生物群体', key: '生物群体', enabled: false, type: 'text', description: '生物群体' },
                    { name: '怪物系统', key: '怪物系统', enabled: false, type: 'text', description: '怪物' },
                    { name: 'NPC设定', key: 'NPC设定', enabled: false, type: 'text', description: 'NPC' },
                    { name: '势力派系', key: '势力派系', enabled: false, type: 'text', description: '势力派系' },
                    { name: '冲突矛盾', key: '冲突矛盾', enabled: false, type: 'text', description: '冲突矛盾' },
                    { name: '联盟关系', key: '联盟关系', enabled: false, type: 'text', description: '联盟关系' },
                    { name: '战争历史', key: '战争历史', enabled: false, type: 'text', description: '战争历史' },
                    // 资源系统
                    { name: '资源系统', key: '资源系统', enabled: false, type: 'text', description: '资源系统' },
                    { name: '材料物资', key: '材料物资', enabled: false, type: 'text', description: '材料物资' },
                    { name: '神器宝物', key: '神器宝物', enabled: false, type: 'text', description: '神器宝物' },
                    { name: '货币系统', key: '货币系统', enabled: false, type: 'text', description: '货币系统' },
                    { name: '贸易网络', key: '贸易网络', enabled: false, type: 'text', description: '贸易网络' },
                    { name: '市场交易', key: '市场交易', enabled: false, type: 'text', description: '市场交易' },
                    { name: '行会组织', key: '行会组织', enabled: false, type: 'text', description: '行会组织' },
                    { name: '交通运输', key: '交通运输', enabled: false, type: 'text', description: '交通运输' }
                ],
                prompts: {
                    init: '从对话中提取世界观设定信息，包括时代背景、地理位置、气候环境等。',
                    insert: '识别对话中提到的新的世界观要素，添加到世界状态面板。',
                    update: '当世界状态发生变化（如时间推进、天气变化等），更新相应字段。',
                    delete: '移除不再适用的世界状态信息。'
                },
                order: 2
            },

            // ===== 3. 交互对象面板 =====
            'interaction': {
                name: '交互对象',
                key: 'interaction',
                id: 'interaction',
                type: 'preset',
                icon: 'fa-solid fa-users',
                description: '记录NPC和交互对象的信息，如姓名、关系、状态、位置等',
                enabled: true,
                subItems: [
                    // 基础信息 (前7个默认启用)
                    { name: 'NPC姓名', key: 'NPC姓名', enabled: true, type: 'text', description: 'NPC的名字' },
                    { name: 'NPC类型', key: 'NPC类型', enabled: true, type: 'text', description: 'NPC的类型或身份' },
                    { name: 'NPC状态', key: 'NPC状态', enabled: true, type: 'text', description: 'NPC的当前状态' },
                    { name: 'NPC关系', key: 'NPC关系', enabled: true, type: 'text', description: '与主角的关系' },
                    { name: 'NPC心情', key: 'NPC心情', enabled: true, type: 'text', description: 'NPC的心情状态' },
                    { name: 'NPC位置', key: 'NPC位置', enabled: true, type: 'text', description: 'NPC所在的位置' },
                    { name: 'NPC特征', key: 'NPC特征', enabled: true, type: 'text', description: 'NPC的特征描述' },

                    // 外貌与装扮 (默认禁用)
                    { name: '外貌特征', key: '外貌特征', enabled: false, type: 'text', description: 'NPC的外貌描述' },
                    { name: '服装/装备', key: '服装/装备', enabled: false, type: 'text', description: 'NPC的服装和装备' },
                    { name: '身高', key: '身高', enabled: false, type: 'text', description: 'NPC的身高' },
                    { name: '体型', key: '体型', enabled: false, type: 'text', description: 'NPC的体型特征' },
                    { name: '发型发色', key: '发型发色', enabled: false, type: 'text', description: 'NPC的发型和发色' },
                    { name: '眼睛颜色', key: '眼睛颜色', enabled: false, type: 'text', description: 'NPC的眼睛颜色' },
                    { name: '特殊标记', key: '特殊标记', enabled: false, type: 'text', description: 'NPC的特殊标记或疤痕' },

                    // 性格与背景 (默认禁用)
                    { name: '性格特征', key: '性格特征', enabled: false, type: 'text', description: 'NPC的性格描述' },
                    { name: '职业/身份', key: '职业/身份', enabled: false, type: 'text', description: 'NPC的职业或社会身份' },
                    { name: '背景/描述', key: '背景/描述', enabled: false, type: 'text', description: 'NPC的背景故事' },
                    { name: '所属派系', key: '所属派系', enabled: false, type: 'text', description: 'NPC所属的组织或派系' },
                    { name: '社会地位', key: '社会地位', enabled: false, type: 'text', description: 'NPC的社会地位' },
                    { name: '家庭背景', key: '家庭背景', enabled: false, type: 'text', description: 'NPC的家庭情况' },
                    { name: '教育程度', key: '教育程度', enabled: false, type: 'text', description: 'NPC的教育背景' },

                    // 关系与情感 (默认禁用)
                    { name: '亲密度', key: '亲密度', enabled: false, type: 'number', description: '与主角的亲密度' },
                    { name: '信任度', key: '信任度', enabled: false, type: 'number', description: '对主角的信任程度' },
                    { name: '友谊度', key: '友谊度', enabled: false, type: 'number', description: '友谊关系深度' },
                    { name: '浪漫度', key: '浪漫度', enabled: false, type: 'number', description: '浪漫关系程度' },
                    { name: '尊重度', key: '尊重度', enabled: false, type: 'number', description: '对主角的尊重程度' },
                    { name: '依赖度', key: '依赖度', enabled: false, type: 'number', description: '对主角的依赖程度' },
                    { name: '冲突度', key: '冲突度', enabled: false, type: 'number', description: '与主角的冲突程度' },
                    { name: '忠诚度', key: '忠诚度', enabled: false, type: 'number', description: 'NPC的忠诚度' },

                    // 状态与活动 (默认禁用)
                    { name: '情绪状态', key: '情绪状态', enabled: false, type: 'text', description: 'NPC当前的情绪' },
                    { name: '当前活动', key: '当前活动', enabled: false, type: 'text', description: 'NPC正在做什么' },
                    { name: '可用性', key: '可用性', enabled: false, type: 'text', description: 'NPC是否可以交互' },
                    { name: '优先级', key: '优先级', enabled: false, type: 'text', description: 'NPC的重要程度' },
                    { name: '健康状态', key: '健康状态', enabled: false, type: 'text', description: 'NPC的健康情况' },
                    { name: '精神状态', key: '精神状态', enabled: false, type: 'text', description: 'NPC的精神状况' },

                    // 互动记录 (默认禁用)
                    { name: '最后联系', key: '最后联系', enabled: false, type: 'text', description: '最后一次联系时间' },
                    { name: '联系频率', key: '联系频率', enabled: false, type: 'text', description: '联系的频繁程度' },
                    { name: '互动历史', key: '互动历史', enabled: false, type: 'text', description: '重要的互动记录' },
                    { name: '对话主题', key: '对话主题', enabled: false, type: 'text', description: '常讨论的话题' },
                    { name: '共同经历', key: '共同经历', enabled: false, type: 'text', description: '共同的经历和回忆' },

                    // 目标与动机 (默认禁用)
                    { name: '目标', key: '目标', enabled: false, type: 'text', description: 'NPC的目标和追求' },
                    { name: '动机', key: '动机', enabled: false, type: 'text', description: 'NPC的行为动机' },
                    { name: '秘密', key: '秘密', enabled: false, type: 'text', description: 'NPC隐藏的秘密' },
                    { name: '弱点', key: '弱点', enabled: false, type: 'text', description: 'NPC的弱点' },
                    { name: '优势', key: '优势', enabled: false, type: 'text', description: 'NPC的优势和长处' },

                    // 能力与技能 (默认禁用)
                    { name: '特殊能力', key: '特殊能力', enabled: false, type: 'text', description: 'NPC的特殊能力' },
                    { name: '技能', key: '技能', enabled: false, type: 'text', description: 'NPC掌握的技能' },
                    { name: '战斗力', key: '战斗力', enabled: false, type: 'text', description: 'NPC的战斗能力' },

                    // 其他信息 (默认禁用)
                    { name: '备注', key: '备注', enabled: false, type: 'text', description: '其他备注信息' },
                    { name: '自动记录', key: '自动记录', enabled: false, type: 'text', description: '系统自动记录的信息' },
                    { name: '标签', key: '标签', enabled: false, type: 'text', description: 'NPC的分类标签' },
                    { name: '重要性', key: '重要性', enabled: false, type: 'text', description: 'NPC在剧情中的重要性' },
                    { name: '首次出现', key: '首次出现', enabled: false, type: 'text', description: 'NPC首次出现的时间或场景' },
                    { name: '最后出现', key: '最后出现', enabled: false, type: 'text', description: 'NPC最后出现的时间或场景' },
                    { name: '出现频率', key: '出现频率', enabled: false, type: 'text', description: 'NPC出现的频率' },
                    { name: '声音特征', key: '声音特征', enabled: false, type: 'text', description: 'NPC的声音特点' },
                    { name: '口头禅', key: '口头禅', enabled: false, type: 'text', description: 'NPC的口头禅或常用语' }
                ],
                prompts: {
                    init: '从对话中识别出现的NPC角色，记录他们的基本信息和状态。',
                    insert: '当对话中出现新的NPC或交互对象时，添加其信息。',
                    update: '更新NPC的状态、位置、关系或其他动态信息。',
                    delete: '移除不再出现或不再重要的NPC信息。'
                },
                order: 3
            },

            // ===== 4. 任务系统面板 =====
            'tasks': {
                name: '任务系统',
                key: 'tasks',
                id: 'tasks',
                type: 'preset',
                icon: 'fa-solid fa-tasks',
                description: '记录当前任务、目标、进度和完成状态',
                enabled: true,
                subItems: [
                    // 基础功能
                    { name: '任务创建', key: '任务创建', enabled: true, type: 'text', description: '创建新任务' },
                    { name: '任务编辑', key: '任务编辑', enabled: true, type: 'text', description: '编辑任务' },
                    { name: '任务删除', key: '任务删除', enabled: true, type: 'text', description: '删除任务' },
                    { name: '任务完成', key: '任务完成', enabled: true, type: 'text', description: '完成任务' },
                    { name: '优先级', key: '优先级', enabled: false, type: 'text', description: '任务优先级' },
                    { name: '截止日期', key: '截止日期', enabled: false, type: 'text', description: '截止时间' },
                    { name: '进度', key: '进度', enabled: false, type: 'text', description: '完成进度' },
                    { name: '状态', key: '状态', enabled: false, type: 'text', description: '任务状态' },
                    // 分类组织
                    { name: '任务分类', key: '任务分类', enabled: false, type: 'text', description: '任务分类' },
                    { name: '任务标签', key: '任务标签', enabled: false, type: 'text', description: '任务标签' },
                    { name: '项目管理', key: '项目管理', enabled: false, type: 'text', description: '项目' },
                    { name: '里程碑', key: '里程碑', enabled: false, type: 'text', description: '里程碑' },
                    { name: '子任务', key: '子任务', enabled: false, type: 'text', description: '子任务' },
                    { name: '依赖关系', key: '依赖关系', enabled: false, type: 'text', description: '任务依赖' },
                    { name: '任务模板', key: '任务模板', enabled: false, type: 'text', description: '任务模板' },
                    { name: '重复任务', key: '重复任务', enabled: false, type: 'text', description: '重复任务' },
                    // 通知提醒
                    { name: '通知系统', key: '通知系统', enabled: true, type: 'text', description: '通知' },
                    { name: '提醒功能', key: '提醒功能', enabled: false, type: 'text', description: '提醒' },
                    { name: '警报设置', key: '警报设置', enabled: false, type: 'text', description: '警报' },
                    { name: '日报总结', key: '日报总结', enabled: false, type: 'text', description: '日报' },
                    { name: '周报回顾', key: '周报回顾', enabled: false, type: 'text', description: '周报' },
                    { name: '成就徽章', key: '成就徽章', enabled: false, type: 'text', description: '成就' },
                    { name: '生产力统计', key: '生产力统计', enabled: false, type: 'text', description: '统计' },
                    { name: '时间追踪', key: '时间追踪', enabled: false, type: 'text', description: '时间追踪' },
                    // 协作功能
                    { name: '任务分配', key: '任务分配', enabled: false, type: 'text', description: '任务分配' },
                    { name: '协作功能', key: '协作功能', enabled: false, type: 'text', description: '协作' },
                    { name: '评论功能', key: '评论功能', enabled: false, type: 'text', description: '评论' },
                    { name: '附件管理', key: '附件管理', enabled: false, type: 'text', description: '附件' },
                    { name: '共享功能', key: '共享功能', enabled: false, type: 'text', description: '共享' },
                    { name: '权限管理', key: '权限管理', enabled: false, type: 'text', description: '权限' },
                    { name: '审批流程', key: '审批流程', enabled: false, type: 'text', description: '审批' },
                    { name: '委派功能', key: '委派功能', enabled: false, type: 'text', description: '委派' },
                    // 视图显示
                    { name: '列表视图', key: '列表视图', enabled: true, type: 'text', description: '列表视图' },
                    { name: '看板视图', key: '看板视图', enabled: false, type: 'text', description: '看板' },
                    { name: '日历视图', key: '日历视图', enabled: false, type: 'text', description: '日历' },
                    { name: '甘特图', key: '甘特图', enabled: false, type: 'text', description: '甘特图' },
                    { name: '排序功能', key: '排序功能', enabled: true, type: 'text', description: '排序' },
                    { name: '筛选功能', key: '筛选功能', enabled: false, type: 'text', description: '筛选' },
                    { name: '搜索功能', key: '搜索功能', enabled: false, type: 'text', description: '搜索' },
                    { name: '分组功能', key: '分组功能', enabled: false, type: 'text', description: '分组' },
                    // 数据管理
                    { name: '备份功能', key: '备份功能', enabled: false, type: 'text', description: '备份' },
                    { name: '导出功能', key: '导出功能', enabled: false, type: 'text', description: '导出' },
                    { name: '导入功能', key: '导入功能', enabled: false, type: 'text', description: '导入' },
                    { name: '同步功能', key: '同步功能', enabled: false, type: 'text', description: '同步' },
                    { name: '归档功能', key: '归档功能', enabled: false, type: 'text', description: '归档' },
                    { name: '历史记录', key: '历史记录', enabled: false, type: 'text', description: '历史' },
                    { name: '版本控制', key: '版本控制', enabled: false, type: 'text', description: '版本' },
                    { name: '数据恢复', key: '数据恢复', enabled: false, type: 'text', description: '恢复' }
                ],
                prompts: {
                    init: '从对话中提取角色接受的任务信息，包括任务目标和要求。',
                    insert: '当角色接受新任务时，添加任务信息到任务系统。',
                    update: '更新任务的进度、状态或其他动态信息。',
                    delete: '移除已完成或已取消的任务。'
                },
                order: 4
            },

            // ===== 5. 组织架构面板 =====
            'organization': {
                name: '组织架构',
                key: 'organization',
                id: 'organization',
                type: 'preset',
                icon: 'fa-solid fa-sitemap',
                description: '记录组织、团体、公司等结构信息',
                enabled: true,
                subItems: [
                    // 基础信息
                    { name: '组织名称', key: '组织名称', enabled: true, type: 'text', description: '组织名称' },
                    { name: '组织类型', key: '组织类型', enabled: true, type: 'text', description: '组织类型' },
                    { name: '组织描述', key: '组织描述', enabled: true, type: 'text', description: '组织描述' },
                    { name: '组织宗旨', key: '组织宗旨', enabled: false, type: 'text', description: '组织宗旨' },
                    { name: '组织历史', key: '组织历史', enabled: false, type: 'text', description: '组织历史' },
                    { name: '成立时间', key: '成立时间', enabled: false, type: 'text', description: '成立时间' },
                    { name: '组织口号', key: '组织口号', enabled: false, type: 'text', description: '组织口号' },
                    { name: '核心价值观', key: '核心价值观', enabled: false, type: 'text', description: '核心价值观' },
                    // 组织结构
                    { name: '层级结构', key: '层级结构', enabled: true, type: 'text', description: '层级结构' },
                    { name: '部门设置', key: '部门设置', enabled: false, type: 'text', description: '部门设置' },
                    { name: '领导层', key: '领导层', enabled: false, type: 'text', description: '领导层' },
                    { name: '理事会', key: '理事会', enabled: false, type: 'text', description: '理事会' },
                    { name: '职位体系', key: '职位体系', enabled: true, type: 'text', description: '职位体系' },
                    { name: '等级制度', key: '等级制度', enabled: false, type: 'text', description: '等级制度' },
                    { name: '晋升机制', key: '晋升机制', enabled: false, type: 'text', description: '晋升机制' },
                    { name: '权力分配', key: '权力分配', enabled: false, type: 'text', description: '权力分配' },
                    // 成员管理
                    { name: '成员管理', key: '成员管理', enabled: true, type: 'text', description: '成员管理' },
                    { name: '招募制度', key: '招募制度', enabled: false, type: 'text', description: '招募制度' },
                    { name: '培训体系', key: '培训体系', enabled: false, type: 'text', description: '培训体系' },
                    { name: '考核评估', key: '考核评估', enabled: false, type: 'text', description: '考核评估' },
                    { name: '奖励机制', key: '奖励机制', enabled: false, type: 'text', description: '奖励机制' },
                    { name: '惩罚制度', key: '惩罚制度', enabled: false, type: 'text', description: '惩罚制度' },
                    { name: '福利待遇', key: '福利待遇', enabled: false, type: 'text', description: '福利待遇' },
                    { name: '退休制度', key: '退休制度', enabled: false, type: 'text', description: '退休制度' },
                    // 规章制度
                    { name: '组织章程', key: '组织章程', enabled: false, type: 'text', description: '组织章程' },
                    { name: '行为准则', key: '行为准则', enabled: false, type: 'text', description: '行为准则' },
                    { name: '道德规范', key: '道德规范', enabled: false, type: 'text', description: '道德规范' },
                    { name: '纪律条例', key: '纪律条例', enabled: false, type: 'text', description: '纪律条例' },
                    { name: '工作流程', key: '工作流程', enabled: false, type: 'text', description: '工作流程' },
                    { name: '操作规程', key: '操作规程', enabled: false, type: 'text', description: '操作规程' },
                    { name: '质量标准', key: '质量标准', enabled: false, type: 'text', description: '质量标准' },
                    { name: '合规要求', key: '合规要求', enabled: false, type: 'text', description: '合规要求' },
                    // 对外关系
                    { name: '盟友组织', key: '盟友组织', enabled: false, type: 'text', description: '盟友组织' },
                    { name: '敌对组织', key: '敌对组织', enabled: false, type: 'text', description: '敌对组织' },
                    { name: '中立组织', key: '中立组织', enabled: false, type: 'text', description: '中立组织' },
                    { name: '合作伙伴', key: '合作伙伴', enabled: false, type: 'text', description: '合作伙伴' },
                    { name: '声誉评价', key: '声誉评价', enabled: false, type: 'text', description: '声誉评价' },
                    { name: '影响力', key: '影响力', enabled: false, type: 'text', description: '影响力' },
                    { name: '外交关系', key: '外交关系', enabled: false, type: 'text', description: '外交关系' },
                    { name: '条约协议', key: '条约协议', enabled: false, type: 'text', description: '条约协议' },
                    // 资源资产
                    { name: '财务状况', key: '财务状况', enabled: false, type: 'text', description: '财务状况' },
                    { name: '资产清单', key: '资产清单', enabled: false, type: 'text', description: '资产清单' },
                    { name: '设施建筑', key: '设施建筑', enabled: false, type: 'text', description: '设施建筑' },
                    { name: '装备器材', key: '装备器材', enabled: false, type: 'text', description: '装备器材' },
                    { name: '技术资源', key: '技术资源', enabled: false, type: 'text', description: '技术资源' },
                    { name: '知识库', key: '知识库', enabled: false, type: 'text', description: '知识库' },
                    { name: '档案资料', key: '档案资料', enabled: false, type: 'text', description: '档案资料' },
                    { name: '机密信息', key: '机密信息', enabled: false, type: 'text', description: '机密信息' }
                ],
                prompts: {
                    init: '从对话中识别组织信息，包括名称、结构、成员等。',
                    insert: '当出现新的组织或团体时，添加其信息。',
                    update: '更新组织的结构、关系或角色在组织中的地位。',
                    delete: '移除不再相关的组织信息。'
                },
                order: 5
            },

            // ===== 6. 新闻资讯面板 =====
            'news': {
                name: '新闻资讯',
                key: 'news',
                id: 'news',
                type: 'preset',
                icon: 'fa-solid fa-newspaper',
                description: '记录世界中的新闻事件、传闻、公告等信息',
                enabled: true,
                subItems: [
                    // 新闻分类
                    { name: '突发新闻', key: '突发新闻', enabled: true, type: 'text', description: '突发新闻' },
                    { name: '政治新闻', key: '政治新闻', enabled: true, type: 'text', description: '政治新闻' },
                    { name: '经济新闻', key: '经济新闻', enabled: true, type: 'text', description: '经济新闻' },
                    { name: '社会新闻', key: '社会新闻', enabled: false, type: 'text', description: '社会新闻' },
                    { name: '军事新闻', key: '军事新闻', enabled: false, type: 'text', description: '军事新闻' },
                    { name: '科技新闻', key: '科技新闻', enabled: false, type: 'text', description: '科技新闻' },
                    { name: '文化新闻', key: '文化新闻', enabled: false, type: 'text', description: '文化新闻' },
                    { name: '体育新闻', key: '体育新闻', enabled: false, type: 'text', description: '体育新闻' },
                    // 新闻来源
                    { name: '官方消息', key: '官方消息', enabled: true, type: 'text', description: '官方消息' },
                    { name: '媒体报道', key: '媒体报道', enabled: false, type: 'text', description: '媒体报道' },
                    { name: '传闻消息', key: '传闻消息', enabled: false, type: 'text', description: '传闻消息' },
                    { name: '内部消息', key: '内部消息', enabled: false, type: 'text', description: '内部消息' },
                    { name: '目击报告', key: '目击报告', enabled: false, type: 'text', description: '目击报告' },
                    { name: '情报信息', key: '情报信息', enabled: false, type: 'text', description: '情报信息' },
                    { name: '泄露文件', key: '泄露文件', enabled: false, type: 'text', description: '泄露文件' },
                    { name: '匿名爆料', key: '匿名爆料', enabled: false, type: 'text', description: '匿名爆料' },
                    // 新闻管理
                    { name: '新闻创建', key: '新闻创建', enabled: true, type: 'text', description: '新闻创建' },
                    { name: '新闻编辑', key: '新闻编辑', enabled: false, type: 'text', description: '新闻编辑' },
                    { name: '新闻审核', key: '新闻审核', enabled: false, type: 'text', description: '新闻审核' },
                    { name: '新闻发布', key: '新闻发布', enabled: false, type: 'text', description: '新闻发布' },
                    { name: '新闻归档', key: '新闻归档', enabled: false, type: 'text', description: '新闻归档' },
                    { name: '新闻删除', key: '新闻删除', enabled: false, type: 'text', description: '新闻删除' },
                    { name: '新闻备份', key: '新闻备份', enabled: false, type: 'text', description: '新闻备份' },
                    { name: '版本控制', key: '版本控制', enabled: false, type: 'text', description: '版本控制' },
                    // 传播渠道
                    { name: '广播推送', key: '广播推送', enabled: false, type: 'text', description: '广播推送' },
                    { name: '新闻简报', key: '新闻简报', enabled: false, type: 'text', description: '新闻简报' },
                    { name: '警报通知', key: '警报通知', enabled: false, type: 'text', description: '警报通知' },
                    { name: '新闻摘要', key: '新闻摘要', enabled: false, type: 'text', description: '新闻摘要' },
                    { name: '社交媒体', key: '社交媒体', enabled: false, type: 'text', description: '社交媒体' },
                    { name: '论坛发布', key: '论坛发布', enabled: false, type: 'text', description: '论坛发布' },
                    { name: '即时通讯', key: '即时通讯', enabled: false, type: 'text', description: '即时通讯' },
                    { name: '邮件通知', key: '邮件通知', enabled: false, type: 'text', description: '邮件通知' },
                    // 互动功能
                    { name: '评论功能', key: '评论功能', enabled: false, type: 'text', description: '评论功能' },
                    { name: '点赞功能', key: '点赞功能', enabled: false, type: 'text', description: '点赞功能' },
                    { name: '分享功能', key: '分享功能', enabled: false, type: 'text', description: '分享功能' },
                    { name: '收藏功能', key: '收藏功能', enabled: false, type: 'text', description: '收藏功能' },
                    { name: '评分系统', key: '评分系统', enabled: false, type: 'text', description: '评分系统' },
                    { name: '投票功能', key: '投票功能', enabled: false, type: 'text', description: '投票功能' },
                    { name: '讨论区', key: '讨论区', enabled: false, type: 'text', description: '讨论区' },
                    { name: '反馈功能', key: '反馈功能', enabled: false, type: 'text', description: '反馈功能' },
                    // 分析统计
                    { name: '新闻分析', key: '新闻分析', enabled: false, type: 'text', description: '新闻分析' },
                    { name: '数据指标', key: '数据指标', enabled: false, type: 'text', description: '数据指标' },
                    { name: '趋势分析', key: '趋势分析', enabled: false, type: 'text', description: '趋势分析' },
                    { name: '统计报告', key: '统计报告', enabled: false, type: 'text', description: '统计报告' },
                    { name: '监控系统', key: '监控系统', enabled: false, type: 'text', description: '监控系统' },
                    { name: '预警系统', key: '预警系统', enabled: false, type: 'text', description: '预警系统' },
                    { name: '自动化', key: '自动化', enabled: false, type: 'text', description: '自动化' },
                    { name: 'AI分析', key: 'AI分析', enabled: false, type: 'text', description: 'AI分析' }
                ],
                prompts: {
                    init: '从对话中提取新闻事件、传闻或公告信息。',
                    insert: '当对话中提到新的新闻或事件时，添加到新闻资讯。',
                    update: '更新新闻的后续发展或真实性状态。',
                    delete: '移除过时或不再重要的新闻信息。'
                },
                order: 6
            },

            // ===== 7. 物品清单面板 =====
            'inventory': {
                name: '物品清单',
                key: 'inventory',
                id: 'inventory',
                type: 'preset',
                icon: 'fa-solid fa-box',
                description: '记录角色拥有的物品、装备、道具等',
                enabled: true,
                subItems: [
                    // 基础功能
                    { name: '物品存储', key: '物品存储', enabled: true, type: 'text', description: '物品存储' },
                    { name: '物品检索', key: '物品检索', enabled: true, type: 'text', description: '物品检索' },
                    { name: '物品整理', key: '物品整理', enabled: true, type: 'text', description: '物品整理' },
                    { name: '物品搜索', key: '物品搜索', enabled: false, type: 'text', description: '物品搜索' },
                    { name: '物品排序', key: '物品排序', enabled: false, type: 'text', description: '物品排序' },
                    { name: '物品筛选', key: '物品筛选', enabled: false, type: 'text', description: '物品筛选' },
                    { name: '物品分类', key: '物品分类', enabled: false, type: 'text', description: '物品分类' },
                    { name: '物品标签', key: '物品标签', enabled: false, type: 'text', description: '物品标签' },
                    // 物品类型
                    { name: '武器装备', key: '武器装备', enabled: true, type: 'text', description: '武器装备' },
                    { name: '防具护甲', key: '防具护甲', enabled: true, type: 'text', description: '防具护甲' },
                    { name: '饰品配件', key: '饰品配件', enabled: false, type: 'text', description: '饰品配件' },
                    { name: '消耗品', key: '消耗品', enabled: false, type: 'text', description: '消耗品' },
                    { name: '材料资源', key: '材料资源', enabled: false, type: 'text', description: '材料资源' },
                    { name: '工具道具', key: '工具道具', enabled: false, type: 'text', description: '工具道具' },
                    { name: '书籍卷轴', key: '书籍卷轴', enabled: false, type: 'text', description: '书籍卷轴' },
                    { name: '珍稀宝物', key: '珍稀宝物', enabled: false, type: 'text', description: '珍稀宝物' },
                    // 容量管理
                    { name: '容量限制', key: '容量限制', enabled: true, type: 'text', description: '容量限制' },
                    { name: '重量系统', key: '重量系统', enabled: false, type: 'text', description: '重量系统' },
                    { name: '堆叠规则', key: '堆叠规则', enabled: false, type: 'text', description: '堆叠规则' },
                    { name: '扩容升级', key: '扩容升级', enabled: false, type: 'text', description: '扩容升级' },
                    { name: '分隔空间', key: '分隔空间', enabled: false, type: 'text', description: '分隔空间' },
                    { name: '保护功能', key: '保护功能', enabled: false, type: 'text', description: '保护功能' },
                    { name: '耐久度', key: '耐久度', enabled: false, type: 'text', description: '耐久度' },
                    { name: '修理维护', key: '修理维护', enabled: false, type: 'text', description: '修理维护' },
                    // 交易功能
                    { name: '交易功能', key: '交易功能', enabled: false, type: 'text', description: '交易功能' },
                    { name: '出售物品', key: '出售物品', enabled: false, type: 'text', description: '出售物品' },
                    { name: '购买物品', key: '购买物品', enabled: false, type: 'text', description: '购买物品' },
                    { name: '拍卖系统', key: '拍卖系统', enabled: false, type: 'text', description: '拍卖系统' },
                    { name: '赠送功能', key: '赠送功能', enabled: false, type: 'text', description: '赠送功能' },
                    { name: '借贷功能', key: '借贷功能', enabled: false, type: 'text', description: '借贷功能' },
                    { name: '共享功能', key: '共享功能', enabled: false, type: 'text', description: '共享功能' },
                    { name: '银行存储', key: '银行存储', enabled: false, type: 'text', description: '银行存储' },
                    // 制作系统
                    { name: '物品制作', key: '物品制作', enabled: false, type: 'text', description: '物品制作' },
                    { name: '配方系统', key: '配方系统', enabled: false, type: 'text', description: '配方系统' },
                    { name: '强化升级', key: '强化升级', enabled: false, type: 'text', description: '强化升级' },
                    { name: '附魔系统', key: '附魔系统', enabled: false, type: 'text', description: '附魔系统' },
                    { name: '物品升级', key: '物品升级', enabled: false, type: 'text', description: '物品升级' },
                    { name: '物品合成', key: '物品合成', enabled: false, type: 'text', description: '物品合成' },
                    { name: '物品拆解', key: '物品拆解', enabled: false, type: 'text', description: '物品拆解' },
                    { name: '物品回收', key: '物品回收', enabled: false, type: 'text', description: '物品回收' },
                    // 智能功能
                    { name: '自动化', key: '自动化', enabled: false, type: 'text', description: '自动化' },
                    { name: 'AI整理', key: 'AI整理', enabled: false, type: 'text', description: 'AI整理' },
                    { name: '智能推荐', key: '智能推荐', enabled: false, type: 'text', description: '智能推荐' },
                    { name: '数据分析', key: '数据分析', enabled: false, type: 'text', description: '数据分析' },
                    { name: '数据备份', key: '数据备份', enabled: false, type: 'text', description: '数据备份' },
                    { name: '云端同步', key: '云端同步', enabled: false, type: 'text', description: '云端同步' },
                    { name: '安全保护', key: '安全保护', enabled: false, type: 'text', description: '安全保护' },
                    { name: '历史记录', key: '历史记录', enabled: false, type: 'text', description: '历史记录' }
                ],
                prompts: {
                    init: '从对话中识别角色拥有的物品、装备或道具。',
                    insert: '当角色获得新物品时，添加到物品清单。',
                    update: '更新物品的数量、状态或其他属性。',
                    delete: '移除已使用、丢弃或失去的物品。'
                },
                order: 7
            },

            // ===== 8. 能力技能面板 =====
            'abilities': {
                name: '能力技能',
                key: 'abilities',
                id: 'abilities',
                type: 'preset',
                icon: 'fa-solid fa-star',
                description: '记录角色的能力、技能、属性等',
                enabled: true,
                subItems: [
                    // 基础属性
                    { name: '力量', key: '力量', enabled: true, type: 'number', description: '力量属性' },
                    { name: '敏捷', key: '敏捷', enabled: true, type: 'number', description: '敏捷属性' },
                    { name: '智力', key: '智力', enabled: true, type: 'number', description: '智力属性' },
                    { name: '体质', key: '体质', enabled: false, type: 'number', description: '体质' },
                    { name: '智慧', key: '智慧', enabled: false, type: 'number', description: '智慧' },
                    { name: '魅力', key: '魅力', enabled: false, type: 'number', description: '魅力' },
                    { name: '运气', key: '运气', enabled: false, type: 'number', description: '运气' },
                    { name: '感知', key: '感知', enabled: false, type: 'number', description: '感知' },
                    // 战斗技能
                    { name: '剑术', key: '剑术', enabled: true, type: 'text', description: '剑术' },
                    { name: '弓术', key: '弓术', enabled: false, type: 'text', description: '弓术' },
                    { name: '魔法', key: '魔法', enabled: true, type: 'text', description: '魔法' },
                    { name: '防御', key: '防御', enabled: false, type: 'text', description: '防御' },
                    { name: '武术', key: '武术', enabled: false, type: 'text', description: '武术' },
                    { name: '潜行', key: '潜行', enabled: false, type: 'text', description: '潜行' },
                    { name: '战术', key: '战术', enabled: false, type: 'text', description: '战术' },
                    { name: '治疗', key: '治疗', enabled: false, type: 'text', description: '治疗' },
                    // 生活技能
                    { name: '制作', key: '制作', enabled: false, type: 'text', description: '制作' },
                    { name: '烹饪', key: '烹饪', enabled: false, type: 'text', description: '烹饪' },
                    { name: '农业', key: '农业', enabled: false, type: 'text', description: '农业' },
                    { name: '采矿', key: '采矿', enabled: false, type: 'text', description: '采矿' },
                    { name: '钓鱼', key: '钓鱼', enabled: false, type: 'text', description: '钓鱼' },
                    { name: '狩猎', key: '狩猎', enabled: false, type: 'text', description: '狩猎' },
                    { name: '交易', key: '交易', enabled: false, type: 'text', description: '交易' },
                    { name: '谈判', key: '谈判', enabled: false, type: 'text', description: '谈判' },
                    // 知识技能
                    { name: '研究', key: '研究', enabled: false, type: 'text', description: '研究' },
                    { name: '调查', key: '调查', enabled: false, type: 'text', description: '调查' },
                    { name: '语言', key: '语言', enabled: false, type: 'text', description: '语言' },
                    { name: '历史', key: '历史', enabled: false, type: 'text', description: '历史' },
                    { name: '医疗', key: '医疗', enabled: false, type: 'text', description: '医疗' },
                    { name: '工程', key: '工程', enabled: false, type: 'text', description: '工程' },
                    { name: '科学', key: '科学', enabled: false, type: 'text', description: '科学' },
                    { name: '艺术', key: '艺术', enabled: false, type: 'text', description: '艺术' },
                    // 社交技能
                    { name: '说服', key: '说服', enabled: false, type: 'text', description: '说服' },
                    { name: '欺骗', key: '欺骗', enabled: false, type: 'text', description: '欺骗' },
                    { name: '威吓', key: '威吓', enabled: false, type: 'text', description: '威吓' },
                    { name: '表演', key: '表演', enabled: false, type: 'text', description: '表演' },
                    { name: '洞察', key: '洞察', enabled: false, type: 'text', description: '洞察' },
                    { name: '驯兽', key: '驯兽', enabled: false, type: 'text', description: '驯兽' },
                    { name: '生存', key: '生存', enabled: false, type: 'text', description: '生存' },
                    { name: '运动', key: '运动', enabled: false, type: 'text', description: '运动' },
                    // 特殊能力
                    { name: '特殊能力', key: '特殊能力', enabled: false, type: 'text', description: '特殊能力' },
                    { name: '天赋', key: '天赋', enabled: false, type: 'text', description: '天赋' },
                    { name: '被动技能', key: '被动技能', enabled: false, type: 'text', description: '被动技能' },
                    { name: '主动技能', key: '主动技能', enabled: false, type: 'text', description: '主动技能' },
                    { name: '终极技能', key: '终极技能', enabled: false, type: 'text', description: '终极技能' },
                    { name: '组合技能', key: '组合技能', enabled: false, type: 'text', description: '组合技能' },
                    { name: '连锁技能', key: '连锁技能', enabled: false, type: 'text', description: '连锁技能' },
                    { name: '限定技能', key: '限定技能', enabled: false, type: 'text', description: '限定技能' }
                ],
                prompts: {
                    init: '从对话中提取角色的能力、技能或特殊才能。',
                    insert: '当角色学会新技能或获得新能力时，添加到能力技能。',
                    update: '更新技能的等级、熟练度或效果。',
                    delete: '移除已失去或不再适用的技能。'
                },
                order: 8
            },

            // ===== 9. 剧情发展面板 =====
            'plot': {
                name: '剧情发展',
                key: 'plot',
                id: 'plot',
                type: 'preset',
                icon: 'fa-solid fa-book',
                description: '记录剧情的发展、关键事件、故事线索等',
                enabled: true,
                subItems: [
                    // 故事线
                    { name: '主线剧情', key: '主线剧情', enabled: true, type: 'text', description: '主线故事' },
                    { name: '支线任务', key: '支线任务', enabled: true, type: 'text', description: '支线任务' },
                    { name: '次要剧情', key: '次要剧情', enabled: true, type: 'text', description: '次要剧情' },
                    { name: '背景故事', key: '背景故事', enabled: false, type: 'text', description: '背景故事' },
                    { name: '序章', key: '序章', enabled: false, type: 'text', description: '序章' },
                    { name: '尾声', key: '尾声', enabled: false, type: 'text', description: '尾声' },
                    { name: '闪回', key: '闪回', enabled: false, type: 'text', description: '闪回' },
                    { name: '伏笔', key: '伏笔', enabled: false, type: 'text', description: '伏笔' },
                    // 剧情结构
                    { name: '铺垫', key: '铺垫', enabled: true, type: 'text', description: '铺垫' },
                    { name: '上升动作', key: '上升动作', enabled: false, type: 'text', description: '上升' },
                    { name: '高潮', key: '高潮', enabled: false, type: 'text', description: '高潮' },
                    { name: '下降动作', key: '下降动作', enabled: false, type: 'text', description: '下降' },
                    { name: '结局', key: '结局', enabled: false, type: 'text', description: '结局' },
                    { name: '尾声段落', key: '尾声段落', enabled: false, type: 'text', description: '尾声' },
                    { name: '悬念', key: '悬念', enabled: false, type: 'text', description: '悬念' },
                    { name: '转折', key: '转折', enabled: false, type: 'text', description: '转折' },
                    // 角色发展
                    { name: '角色成长', key: '角色成长', enabled: false, type: 'text', description: '角色成长' },
                    { name: '关系发展', key: '关系发展', enabled: false, type: 'text', description: '关系发展' },
                    { name: '动机', key: '动机', enabled: false, type: 'text', description: '动机' },
                    { name: '冲突', key: '冲突', enabled: false, type: 'text', description: '冲突' },
                    { name: '内部冲突', key: '内部冲突', enabled: false, type: 'text', description: '内部冲突' },
                    { name: '外部冲突', key: '外部冲突', enabled: false, type: 'text', description: '外部冲突' },
                    { name: '道德困境', key: '道德困境', enabled: false, type: 'text', description: '道德困境' },
                    { name: '牺牲', key: '牺牲', enabled: false, type: 'text', description: '牺牲' },
                    // 叙事技巧
                    { name: '对话', key: '对话', enabled: false, type: 'text', description: '对话' },
                    { name: '旁白', key: '旁白', enabled: false, type: 'text', description: '旁白' },
                    { name: '独白', key: '独白', enabled: false, type: 'text', description: '独白' },
                    { name: '象征', key: '象征', enabled: false, type: 'text', description: '象征' },
                    { name: '主题', key: '主题', enabled: false, type: 'text', description: '主题' },
                    { name: '氛围', key: '氛围', enabled: false, type: 'text', description: '氛围' },
                    { name: '基调', key: '基调', enabled: false, type: 'text', description: '基调' },
                    { name: '节奏', key: '节奏', enabled: false, type: 'text', description: '节奏' },
                    // 互动性
                    { name: '选择', key: '选择', enabled: false, type: 'text', description: '选择' },
                    { name: '后果', key: '后果', enabled: false, type: 'text', description: '后果' },
                    { name: '分支', key: '分支', enabled: false, type: 'text', description: '分支' },
                    { name: '多重结局', key: '多重结局', enabled: false, type: 'text', description: '多重结局' },
                    { name: '玩家主导权', key: '玩家主导权', enabled: false, type: 'text', description: '玩家主导权' },
                    { name: '涌现叙事', key: '涌现叙事', enabled: false, type: 'text', description: '涌现叙事' },
                    { name: '程序生成', key: '程序生成', enabled: false, type: 'text', description: '程序生成' },
                    { name: '自适应叙事', key: '自适应叙事', enabled: false, type: 'text', description: '自适应叙事' },
                    // 管理工具
                    { name: '时间线', key: '时间线', enabled: false, type: 'text', description: '时间线' },
                    { name: '笔记', key: '笔记', enabled: false, type: 'text', description: '笔记' },
                    { name: '书签', key: '书签', enabled: false, type: 'text', description: '书签' },
                    { name: '存档点', key: '存档点', enabled: false, type: 'text', description: '存档' },
                    { name: '自动保存', key: '自动保存', enabled: false, type: 'text', description: '自动保存' },
                    { name: '导出', key: '导出', enabled: false, type: 'text', description: '导出' },
                    { name: '导入', key: '导入', enabled: false, type: 'text', description: '导入' },
                    { name: '数据分析', key: '数据分析', enabled: false, type: 'text', description: '数据分析' }
                ],
                prompts: {
                    init: '从对话中识别剧情发展和关键事件。',
                    insert: '当发生重要剧情事件时，添加到剧情发展。',
                    update: '更新剧情的进展、阶段或线索信息。',
                    delete: '移除已解决或不再相关的剧情信息。'
                },
                order: 9
            },

            // ===== 10. 修炼体系面板 =====
            'cultivation': {
                name: '修炼体系',
                key: 'cultivation',
                id: 'cultivation',
                type: 'preset',
                icon: 'fa-solid fa-yin-yang',
                description: '记录修炼境界、功法、修为等信息（适用于修仙、武侠题材）',
                enabled: true,
                subItems: [
                    // 修炼境界
                    { name: '炼气期', key: '炼气期', enabled: true, type: 'text', description: '炼气期' },
                    { name: '筑基期', key: '筑基期', enabled: true, type: 'text', description: '筑基期' },
                    { name: '金丹期', key: '金丹期', enabled: true, type: 'text', description: '金丹期' },
                    { name: '元婴期', key: '元婴期', enabled: false, type: 'text', description: '元婴期' },
                    { name: '化神期', key: '化神期', enabled: false, type: 'text', description: '化神期' },
                    { name: '炼虚期', key: '炼虚期', enabled: false, type: 'text', description: '炼虚期' },
                    { name: '合体期', key: '合体期', enabled: false, type: 'text', description: '合体期' },
                    { name: '大乘期', key: '大乘期', enabled: false, type: 'text', description: '大乘期' },
                    { name: '渡劫期', key: '渡劫期', enabled: false, type: 'text', description: '渡劫期' },
                    { name: '地仙', key: '地仙', enabled: false, type: 'text', description: '地仙' },
                    { name: '真仙', key: '真仙', enabled: false, type: 'text', description: '真仙' },
                    { name: '金仙', key: '金仙', enabled: false, type: 'text', description: '金仙' },
                    // 修炼功法
                    { name: '呼吸法', key: '呼吸法', enabled: true, type: 'text', description: '呼吸法' },
                    { name: '炼体术', key: '炼体术', enabled: false, type: 'text', description: '炼体术' },
                    { name: '神魂修炼', key: '神魂修炼', enabled: false, type: 'text', description: '神魂修炼' },
                    { name: '双修功法', key: '双修功法', enabled: false, type: 'text', description: '双修' },
                    { name: '剑道修炼', key: '剑道修炼', enabled: false, type: 'text', description: '剑道' },
                    { name: '炼丹术', key: '炼丹术', enabled: false, type: 'text', description: '炼丹' },
                    { name: '阵法', key: '阵法', enabled: false, type: 'text', description: '阵法' },
                    { name: '符箓', key: '符箓', enabled: false, type: 'text', description: '符箓' },
                    // 修炼资源
                    { name: '灵力', key: '灵力', enabled: true, type: 'number', description: '灵力值' },
                    { name: '灵根', key: '灵根', enabled: false, type: 'text', description: '灵根' },
                    { name: '经脉', key: '经脉', enabled: false, type: 'text', description: '经脉' },
                    { name: '丹田', key: '丹田', enabled: false, type: 'text', description: '丹田' },
                    { name: '神识', key: '神识', enabled: false, type: 'text', description: '神识' },
                    { name: '寿元', key: '寿元', enabled: false, type: 'text', description: '寿元' },
                    { name: '因果业力', key: '因果业力', enabled: false, type: 'text', description: '因果' },
                    { name: '气运', key: '气运', enabled: false, type: 'text', description: '气运' }
                ],
                prompts: {
                    init: '从对话中提取修炼体系相关信息，如境界、功法等。',
                    insert: '当角色学习新功法或获得法宝时，添加相关信息。',
                    update: '更新修为进度、境界或功法等级。',
                    delete: '移除已废弃的功法或失去的法宝。'
                },
                order: 10
            },

            // ===== 11. 奇幻设定面板 =====
            'fantasy': {
                name: '奇幻设定',
                key: 'fantasy',
                id: 'fantasy',
                type: 'preset',
                icon: 'fa-solid fa-dragon',
                description: '记录奇幻世界的设定，如种族、神话、魔法体系等',
                enabled: true,
                subItems: [
                    // 基础设定（默认启用）
                    { name: '世界名称', key: '世界名称', enabled: true, type: 'text', description: '奇幻世界的名称' },
                    { name: '世界类型', key: '世界类型', enabled: true, type: 'text', description: '高魔/低魔/剑与魔法等' },
                    { name: '魔法体系', key: '魔法体系', enabled: true, type: 'text', description: '魔法系统的基本规则' },
                    { name: '神话传说', key: '神话传说', enabled: true, type: 'text', description: '创世神话和传说' },
                    { name: '主要种族', key: '主要种族', enabled: true, type: 'text', description: '世界中的主要种族' },

                    // 种族详细信息
                    { name: '人类', key: '人类', enabled: false, type: 'text', description: '人类种族的特点' },
                    { name: '精灵', key: '精灵', enabled: false, type: 'text', description: '精灵种族的特点' },
                    { name: '矮人', key: '矮人', enabled: false, type: 'text', description: '矮人种族的特点' },
                    { name: '兽人', key: '兽人', enabled: false, type: 'text', description: '兽人种族的特点' },
                    { name: '龙族', key: '龙族', enabled: false, type: 'text', description: '龙族的特点' },
                    { name: '半精灵', key: '半精灵', enabled: false, type: 'text', description: '半精灵的特点' },
                    { name: '半兽人', key: '半兽人', enabled: false, type: 'text', description: '半兽人的特点' },
                    { name: '种族寿命', key: '种族寿命', enabled: false, type: 'text', description: '各种族的寿命' },
                    { name: '种族能力', key: '种族能力', enabled: false, type: 'text', description: '各种族的特殊能力' },
                    { name: '种族文化', key: '种族文化', enabled: false, type: 'text', description: '各种族的文化特色' },

                    // 神话与信仰
                    { name: '神灵信仰', key: '神灵信仰', enabled: false, type: 'text', description: '主要神灵' },
                    { name: '创世神话', key: '创世神话', enabled: false, type: 'text', description: '世界的创世传说' },
                    { name: '古老预言', key: '古老预言', enabled: false, type: 'text', description: '重要的预言' },
                    { name: '圣物传说', key: '圣物传说', enabled: false, type: 'text', description: '传说中的圣物' },
                    { name: '神殿教会', key: '神殿教会', enabled: false, type: 'text', description: '宗教组织' },

                    // 魔法生物
                    { name: '魔法生物', key: '魔法生物', enabled: false, type: 'text', description: '魔法生物总览' },
                    { name: '亡灵', key: '亡灵', enabled: false, type: 'text', description: '亡灵生物' },
                    { name: '恶魔', key: '恶魔', enabled: false, type: 'text', description: '恶魔种类' },
                    { name: '天使', key: '天使', enabled: false, type: 'text', description: '天使种类' },
                    { name: '元素生物', key: '元素生物', enabled: false, type: 'text', description: '元素生物' },
                    { name: '魔兽', key: '魔兽', enabled: false, type: 'text', description: '魔法野兽' },
                    { name: '幻兽', key: '幻兽', enabled: false, type: 'text', description: '神话幻兽' },

                    // 地理与环境
                    { name: '魔法森林', key: '魔法森林', enabled: false, type: 'text', description: '魔法森林' },
                    { name: '龙巢', key: '龙巢', enabled: false, type: 'text', description: '龙的巢穴' },
                    { name: '精灵王国', key: '精灵王国', enabled: false, type: 'text', description: '精灵的国度' },
                    { name: '矮人山脉', key: '矮人山脉', enabled: false, type: 'text', description: '矮人的山脉' },
                    { name: '魔法塔', key: '魔法塔', enabled: false, type: 'text', description: '魔法师的塔' },
                    { name: '古代遗迹', key: '古代遗迹', enabled: false, type: 'text', description: '古代遗迹' },

                    // 魔法物品与遗产
                    { name: '传奇武器', key: '传奇武器', enabled: false, type: 'text', description: '传奇武器' },
                    { name: '魔法护甲', key: '魔法护甲', enabled: false, type: 'text', description: '魔法护甲' },
                    { name: '神器', key: '神器', enabled: false, type: 'text', description: '神器' },
                    { name: '魔法卷轴', key: '魔法卷轴', enabled: false, type: 'text', description: '魔法卷轴' },
                    { name: '炼金物品', key: '炼金物品', enabled: false, type: 'text', description: '炼金物品' },
                    { name: '魔法宝石', key: '魔法宝石', enabled: false, type: 'text', description: '魔法宝石' }
                ],
                prompts: {
                    init: '从对话中提取奇幻设定元素，如种族、魔法、神话等。',
                    insert: '当对话中出现新的奇幻设定时，添加相关信息。',
                    update: '更新对奇幻设定的认知或发现新的信息。',
                    delete: '移除错误或不再适用的奇幻设定信息。'
                },
                order: 11
            },

            // ===== 12. 现代设定面板 =====
            'modern': {
                name: '现代设定',
                key: 'modern',
                id: 'modern',
                type: 'preset',
                icon: 'fa-solid fa-city',
                description: '记录现代背景的设定，如城市、科技、社交等',
                enabled: true,
                subItems: [
                    // 基础信息（默认启用）
                    { name: '所在城市', key: '所在城市', enabled: true, type: 'text', description: '居住的城市' },
                    { name: '城市区域', key: '城市区域', enabled: true, type: 'text', description: '所在区域' },
                    { name: '住址', key: '住址', enabled: true, type: 'text', description: '详细住址' },
                    { name: '住房类型', key: '住房类型', enabled: true, type: 'text', description: '公寓/别墅/合租等' },
                    { name: '职业', key: '职业', enabled: true, type: 'text', description: '职业' },

                    // 城市生活
                    { name: '城市生活', key: '城市生活', enabled: false, type: 'text', description: '城市生活概况' },
                    { name: '生活节奏', key: '生活节奏', enabled: false, type: 'text', description: '生活节奏' },
                    { name: '城市地标', key: '城市地标', enabled: false, type: 'text', description: '重要地标' },
                    { name: '社区环境', key: '社区环境', enabled: false, type: 'text', description: '社区环境' },
                    { name: '邻居关系', key: '邻居关系', enabled: false, type: 'text', description: '邻居关系' },

                    // 科技与设备
                    { name: '科技发展', key: '科技发展', enabled: false, type: 'text', description: '科技水平' },
                    { name: '手机型号', key: '手机型号', enabled: false, type: 'text', description: '使用的手机' },
                    { name: '电脑设备', key: '电脑设备', enabled: false, type: 'text', description: '电脑设备' },
                    { name: '智能设备', key: '智能设备', enabled: false, type: 'text', description: '智能家居设备' },
                    { name: '网络环境', key: '网络环境', enabled: false, type: 'text', description: '网络环境' },

                    // 社交网络
                    { name: '社交网络', key: '社交网络', enabled: false, type: 'text', description: '社交媒体使用' },
                    { name: '社交平台', key: '社交平台', enabled: false, type: 'text', description: '常用平台' },
                    { name: '社交账号', key: '社交账号', enabled: false, type: 'text', description: '账号信息' },
                    { name: '粉丝数量', key: '粉丝数量', enabled: false, type: 'number', description: '粉丝数' },
                    { name: '网络形象', key: '网络形象', enabled: false, type: 'text', description: '网络形象' },

                    // 职场环境
                    { name: '职场环境', key: '职场环境', enabled: false, type: 'text', description: '工作环境' },
                    { name: '公司名称', key: '公司名称', enabled: false, type: 'text', description: '公司名称' },
                    { name: '职位', key: '职位', enabled: false, type: 'text', description: '职位' },
                    { name: '部门', key: '部门', enabled: false, type: 'text', description: '部门' },
                    { name: '同事关系', key: '同事关系', enabled: false, type: 'text', description: '同事关系' },
                    { name: '工作时间', key: '工作时间', enabled: false, type: 'text', description: '工作时间' },
                    { name: '通勤方式', key: '通勤方式', enabled: false, type: 'text', description: '通勤方式' },

                    // 日常生活
                    { name: '日常生活', key: '日常生活', enabled: false, type: 'text', description: '日常生活' },
                    { name: '作息时间', key: '作息时间', enabled: false, type: 'text', description: '作息时间' },
                    { name: '饮食习惯', key: '饮食习惯', enabled: false, type: 'text', description: '饮食习惯' },
                    { name: '运动健身', key: '运动健身', enabled: false, type: 'text', description: '运动健身' },
                    { name: '兴趣爱好', key: '兴趣爱好', enabled: false, type: 'text', description: '兴趣爱好' },

                    // 交通出行
                    { name: '交通出行', key: '交通出行', enabled: false, type: 'text', description: '交通方式' },
                    { name: '私家车', key: '私家车', enabled: false, type: 'text', description: '私家车信息' },
                    { name: '公共交通', key: '公共交通', enabled: false, type: 'text', description: '公共交通' },
                    { name: '出行习惯', key: '出行习惯', enabled: false, type: 'text', description: '出行习惯' },

                    // 娱乐消费
                    { name: '娱乐消遣', key: '娱乐消遣', enabled: false, type: 'text', description: '娱乐活动' },
                    { name: '购物消费', key: '购物消费', enabled: false, type: 'text', description: '购物习惯' },
                    { name: '月收入', key: '月收入', enabled: false, type: 'number', description: '月收入' },
                    { name: '月支出', key: '月支出', enabled: false, type: 'number', description: '月支出' },
                    { name: '储蓄', key: '储蓄', enabled: false, type: 'number', description: '储蓄' },
                    { name: '资产', key: '资产', enabled: false, type: 'text', description: '资产情况' }
                ],
                prompts: {
                    init: '从对话中提取现代生活相关信息，如住址、工作、社交等。',
                    insert: '当对话中提到新的现代生活要素时，添加相关信息。',
                    update: '更新住址、工作、经济状况等信息。',
                    delete: '移除过时的现代生活信息。'
                },
                order: 12
            },

            // ===== 13. 历史设定面板 =====
            'historical': {
                name: '历史设定',
                key: 'historical',
                id: 'historical',
                type: 'preset',
                icon: 'fa-solid fa-landmark',
                description: '记录历史背景的设定，如朝代、历史事件等',
                enabled: true,
                subItems: [
                    // 基础信息（默认启用）
                    { name: '朝代', key: '朝代', enabled: true, type: 'text', description: '朝代名称' },
                    { name: '皇帝', key: '皇帝', enabled: true, type: 'text', description: '当朝皇帝' },
                    { name: '年号', key: '年号', enabled: true, type: 'text', description: '年号' },
                    { name: '历史时期', key: '历史时期', enabled: true, type: 'text', description: '历史时期' },
                    { name: '当前年份', key: '当前年份', enabled: true, type: 'text', description: '当前年份' },

                    // 朝廷政治
                    { name: '朝廷', key: '朝廷', enabled: false, type: 'text', description: '朝廷概况' },
                    { name: '政治制度', key: '政治制度', enabled: false, type: 'text', description: '政治制度' },
                    { name: '皇室', key: '皇室', enabled: false, type: 'text', description: '皇室成员' },
                    { name: '太子', key: '太子', enabled: false, type: 'text', description: '太子' },
                    { name: '皇后', key: '皇后', enabled: false, type: 'text', description: '皇后' },
                    { name: '后宫', key: '后宫', enabled: false, type: 'text', description: '后宫' },
                    { name: '宦官', key: '宦官', enabled: false, type: 'text', description: '宦官势力' },

                    // 官职体系
                    { name: '官职', key: '官职', enabled: false, type: 'text', description: '官职' },
                    { name: '官职品级', key: '官职品级', enabled: false, type: 'text', description: '品级制度' },
                    { name: '丞相', key: '丞相', enabled: false, type: 'text', description: '丞相' },
                    { name: '六部', key: '六部', enabled: false, type: 'text', description: '六部' },
                    { name: '地方官员', key: '地方官员', enabled: false, type: 'text', description: '地方官员' },
                    { name: '俸禄制度', key: '俸禄制度', enabled: false, type: 'text', description: '俸禄制度' },

                    // 门阀世家
                    { name: '门阀世家', key: '门阀世家', enabled: false, type: 'text', description: '门阀世家' },
                    { name: '世家大族', key: '世家大族', enabled: false, type: 'text', description: '世家大族' },
                    { name: '家族势力', key: '家族势力', enabled: false, type: 'text', description: '家族势力' },
                    { name: '家族关系', key: '家族关系', enabled: false, type: 'text', description: '家族关系' },
                    { name: '联姻', key: '联姻', enabled: false, type: 'text', description: '政治联姻' },

                    // 历史事件
                    { name: '历史事件', key: '历史事件', enabled: false, type: 'text', description: '重大历史事件' },
                    { name: '战争', key: '战争', enabled: false, type: 'text', description: '战争' },
                    { name: '变革', key: '变革', enabled: false, type: 'text', description: '变革' },
                    { name: '灾难', key: '灾难', enabled: false, type: 'text', description: '灾难' },
                    { name: '起义', key: '起义', enabled: false, type: 'text', description: '起义' },
                    { name: '外交', key: '外交', enabled: false, type: 'text', description: '外交关系' },

                    // 文化习俗
                    { name: '礼仪制度', key: '礼仪制度', enabled: false, type: 'text', description: '礼仪制度' },
                    { name: '节日', key: '节日', enabled: false, type: 'text', description: '传统节日' },
                    { name: '服饰', key: '服饰', enabled: false, type: 'text', description: '服饰制度' },
                    { name: '饮食', key: '饮食', enabled: false, type: 'text', description: '饮食文化' },
                    { name: '建筑', key: '建筑', enabled: false, type: 'text', description: '建筑风格' },
                    { name: '文学艺术', key: '文学艺术', enabled: false, type: 'text', description: '文学艺术' },

                    // 地理区划
                    { name: '州府', key: '州府', enabled: false, type: 'text', description: '州府' },
                    { name: '郡县', key: '郡县', enabled: false, type: 'text', description: '郡县' },
                    { name: '边疆', key: '边疆', enabled: false, type: 'text', description: '边疆' },
                    { name: '都城', key: '都城', enabled: false, type: 'text', description: '都城' },
                    { name: '重要城市', key: '重要城市', enabled: false, type: 'text', description: '重要城市' }
                ],
                prompts: {
                    init: '从对话中提取历史背景信息，如朝代、官职、事件等。',
                    insert: '当对话中提到新的历史要素时，添加相关信息。',
                    update: '更新历史事件的发展或角色的官职变化。',
                    delete: '移除不再相关的历史信息。'
                },
                order: 13
            },

            // ===== 14. 魔法系统面板 =====
            'magic': {
                name: '魔法系统',
                key: 'magic',
                id: 'magic',
                type: 'preset',
                icon: 'fa-solid fa-wand-magic-sparkles',
                description: '记录魔法体系，如魔力、咒语、魔法道具等',
                enabled: true,
                subItems: [
                    // 基础属性（默认启用）
                    { name: '魔力值', key: '魔力值', enabled: true, type: 'number', description: '当前魔力值' },
                    { name: '最大魔力', key: '最大魔力', enabled: true, type: 'number', description: '最大魔力值' },
                    { name: '魔法等级', key: '魔法等级', enabled: true, type: 'text', description: '魔法师等级' },
                    { name: '魔法元素', key: '魔法元素', enabled: true, type: 'text', description: '擅长的魔法元素' },
                    { name: '魔法天赋', key: '魔法天赋', enabled: true, type: 'text', description: '魔法天赋' },

                    // 魔力系统
                    { name: '魔力恢复', key: '魔力恢复', enabled: false, type: 'text', description: '魔力恢复速度' },
                    { name: '魔力消耗', key: '魔力消耗', enabled: false, type: 'text', description: '魔力消耗' },
                    { name: '魔力池', key: '魔力池', enabled: false, type: 'text', description: '魔力池' },
                    { name: '魔力控制', key: '魔力控制', enabled: false, type: 'text', description: '魔力控制能力' },
                    { name: '魔力感知', key: '魔力感知', enabled: false, type: 'text', description: '魔力感知能力' },

                    // 魔法学派
                    { name: '元素魔法', key: '元素魔法', enabled: false, type: 'text', description: '元素魔法' },
                    { name: '召唤魔法', key: '召唤魔法', enabled: false, type: 'text', description: '召唤魔法' },
                    { name: '变化魔法', key: '变化魔法', enabled: false, type: 'text', description: '变化魔法' },
                    { name: '附魔魔法', key: '附魔魔法', enabled: false, type: 'text', description: '附魔魔法' },
                    { name: '幻术魔法', key: '幻术魔法', enabled: false, type: 'text', description: '幻术魔法' },
                    { name: '预言魔法', key: '预言魔法', enabled: false, type: 'text', description: '预言魔法' },
                    { name: '死灵魔法', key: '死灵魔法', enabled: false, type: 'text', description: '死灵魔法' },
                    { name: '治疗魔法', key: '治疗魔法', enabled: false, type: 'text', description: '治疗魔法' },

                    // 咒语详细
                    { name: '咒语', key: '咒语', enabled: false, type: 'text', description: '掌握的咒语' },
                    { name: '初级咒语', key: '初级咒语', enabled: false, type: 'text', description: '初级咒语' },
                    { name: '中级咒语', key: '中级咒语', enabled: false, type: 'text', description: '中级咒语' },
                    { name: '高级咒语', key: '高级咒语', enabled: false, type: 'text', description: '高级咒语' },
                    { name: '禁忌咒语', key: '禁忌咒语', enabled: false, type: 'text', description: '禁忌咒语' },
                    { name: '咒语冷却', key: '咒语冷却', enabled: false, type: 'text', description: '咒语冷却时间' },

                    // 魔法道具
                    { name: '魔杖', key: '魔杖', enabled: false, type: 'text', description: '魔杖' },
                    { name: '法杖', key: '法杖', enabled: false, type: 'text', description: '法杖' },
                    { name: '法术书', key: '法术书', enabled: false, type: 'text', description: '法术书' },
                    { name: '魔法道具', key: '魔法道具', enabled: false, type: 'text', description: '其他魔法道具' },
                    { name: '法袍', key: '法袍', enabled: false, type: 'text', description: '法袍' },
                    { name: '护符', key: '护符', enabled: false, type: 'text', description: '护符' },
                    { name: '魔法戒指', key: '魔法戒指', enabled: false, type: 'text', description: '魔法戒指' },
                    { name: '魔法药水', key: '魔法药水', enabled: false, type: 'text', description: '魔法药水' },

                    // 魔法生物
                    { name: '召唤兽', key: '召唤兽', enabled: false, type: 'text', description: '召唤兽' },
                    { name: '契约兽', key: '契约兽', enabled: false, type: 'text', description: '契约兽' },
                    { name: '元素精灵', key: '元素精灵', enabled: false, type: 'text', description: '元素精灵' },
                    { name: '魔法宠物', key: '魔法宠物', enabled: false, type: 'text', description: '魔法宠物' },

                    // 魔法限制
                    { name: '魔法禁忌', key: '魔法禁忌', enabled: false, type: 'text', description: '魔法禁忌' },
                    { name: '魔法代价', key: '魔法代价', enabled: false, type: 'text', description: '使用魔法的代价' },
                    { name: '魔法副作用', key: '魔法副作用', enabled: false, type: 'text', description: '魔法副作用' },
                    { name: '魔法限制', key: '魔法限制', enabled: false, type: 'text', description: '魔法限制' }
                ],
                prompts: {
                    init: '从对话中提取魔法系统相关信息，如魔力、咒语、道具等。',
                    insert: '当角色学习新咒语或获得魔法道具时，添加相关信息。',
                    update: '更新魔力值、魔法等级或咒语掌握情况。',
                    delete: '移除已失效的魔法契约或失去的魔法道具。'
                },
                order: 14
            },

            // ===== 15. 训练系统面板 =====
            'training': {
                name: '训练系统',
                key: 'training',
                id: 'training',
                type: 'preset',
                icon: 'fa-solid fa-dumbbell',
                description: '记录训练、调教、成长相关的信息',
                enabled: true,
                subItems: [
                    // 基础信息（默认启用）
                    { name: '训练类型', key: '训练类型', enabled: true, type: 'text', description: '训练类型' },
                    { name: '训练目标', key: '训练目标', enabled: true, type: 'text', description: '训练目标' },
                    { name: '训练进度', key: '训练进度', enabled: true, type: 'text', description: '训练进度' },
                    { name: '训练等级', key: '训练等级', enabled: true, type: 'text', description: '训练等级' },
                    { name: '训练师', key: '训练师', enabled: true, type: 'text', description: '训练师' },

                    // 训练计划
                    { name: '训练计划', key: '训练计划', enabled: false, type: 'text', description: '训练计划' },
                    { name: '训练课程', key: '训练课程', enabled: false, type: 'text', description: '训练课程' },
                    { name: '训练时间表', key: '训练时间表', enabled: false, type: 'text', description: '训练时间表' },
                    { name: '训练周期', key: '训练周期', enabled: false, type: 'text', description: '训练周期' },
                    { name: '训练阶段', key: '训练阶段', enabled: false, type: 'text', description: '训练阶段' },

                    // 训练强度
                    { name: '训练强度', key: '训练强度', enabled: false, type: 'text', description: '训练强度' },
                    { name: '训练频率', key: '训练频率', enabled: false, type: 'text', description: '训练频率' },
                    { name: '训练时长', key: '训练时长', enabled: false, type: 'text', description: '训练时长' },
                    { name: '训练难度', key: '训练难度', enabled: false, type: 'text', description: '训练难度' },

                    // 训练方法
                    { name: '训练方法', key: '训练方法', enabled: false, type: 'text', description: '训练方法' },
                    { name: '训练技巧', key: '训练技巧', enabled: false, type: 'text', description: '训练技巧' },
                    { name: '训练器材', key: '训练器材', enabled: false, type: 'text', description: '训练器材' },
                    { name: '训练场地', key: '训练场地', enabled: false, type: 'text', description: '训练场地' },
                    { name: '训练环境', key: '训练环境', enabled: false, type: 'text', description: '训练环境' },

                    // 成长记录
                    { name: '训练效果', key: '训练效果', enabled: false, type: 'text', description: '训练效果' },
                    { name: '训练成果', key: '训练成果', enabled: false, type: 'text', description: '训练成果' },
                    { name: '成长等级', key: '成长等级', enabled: false, type: 'text', description: '成长等级' },
                    { name: '经验值', key: '经验值', enabled: false, type: 'number', description: '经验值' },
                    { name: '成就', key: '成就', enabled: false, type: 'text', description: '训练成就' },
                    { name: '突破', key: '突破', enabled: false, type: 'text', description: '突破记录' },

                    // 身体数据
                    { name: '体能', key: '体能', enabled: false, type: 'number', description: '体能' },
                    { name: '力量', key: '力量', enabled: false, type: 'number', description: '力量' },
                    { name: '敏捷', key: '敏捷', enabled: false, type: 'number', description: '敏捷' },
                    { name: '耐力', key: '耐力', enabled: false, type: 'number', description: '耐力' },
                    { name: '柔韧性', key: '柔韧性', enabled: false, type: 'number', description: '柔韧性' },
                    { name: '反应速度', key: '反应速度', enabled: false, type: 'number', description: '反应速度' },

                    // 心理状态
                    { name: '意志力', key: '意志力', enabled: false, type: 'number', description: '意志力' },
                    { name: '专注力', key: '专注力', enabled: false, type: 'number', description: '专注力' },
                    { name: '动力', key: '动力', enabled: false, type: 'text', description: '训练动力' },
                    { name: '心理状态', key: '心理状态', enabled: false, type: 'text', description: '心理状态' },
                    { name: '压力水平', key: '压力水平', enabled: false, type: 'text', description: '压力水平' },

                    // 训练奖惩
                    { name: '奖励', key: '奖励', enabled: false, type: 'text', description: '训练奖励' },
                    { name: '惩罚', key: '惩罚', enabled: false, type: 'text', description: '训练惩罚' },
                    { name: '激励措施', key: '激励措施', enabled: false, type: 'text', description: '激励措施' },

                    // 下一步计划
                    { name: '下次训练', key: '下次训练', enabled: false, type: 'text', description: '下次训练' },
                    { name: '改进方向', key: '改进方向', enabled: false, type: 'text', description: '改进方向' }
                ],
                prompts: {
                    init: '从对话中提取训练相关信息，如训练项目、进度、目标等。',
                    insert: '当开始新的训练项目时，添加相关信息。',
                    update: '更新训练进度、成果或下一步计划。',
                    delete: '移除已完成或取消的训练项目。'
                },
                order: 15
            }
        };
    }

    /**
     * 获取预设面板的英文键名到中文显示名的映射
     * 用于UI显示和数据迁移
     */
    static getPanelNameMapping() {
        return {
            'personal': '个人信息',
            'world': '世界状态',
            'interaction': '交互对象',
            'tasks': '任务系统',
            'organization': '组织架构',
            'news': '新闻资讯',
            'inventory': '物品清单',
            'abilities': '能力技能',
            'plot': '剧情发展',
            'cultivation': '修炼体系',
            'fantasy': '奇幻设定',
            'modern': '现代设定',
            'historical': '历史设定',
            'magic': '魔法系统',
            'training': '训练系统'
        };
    }

    /**
     * 🔧 兼容性方法：保持向后兼容
     * @deprecated 使用 getPanelNameMapping() 代替
     */
    static getOldIdMapping() {
        return this.getPanelNameMapping();
    }

    /**
     * 根据英文键名获取中文显示名
     */
    static getChineseNameByKey(key) {
        const mapping = this.getPanelNameMapping();
        return mapping[key] || null;
    }

    /**
     * 根据中文显示名获取英文键名
     */
    static getKeyByChineseName(chineseName) {
        const mapping = this.getPanelNameMapping();
        for (const [key, name] of Object.entries(mapping)) {
            if (name === chineseName) {
                return key;
            }
        }
        return null;
    }

    /**
     * 🔧 兼容性方法：保持向后兼容
     * @deprecated 使用 getChineseNameByKey() 代替
     */
    static getNewKeyByOldId(oldId) {
        return this.getChineseNameByKey(oldId);
    }

    /**
     * 🔧 兼容性方法：保持向后兼容
     * @deprecated 使用 getKeyByChineseName() 代替
     */
    static getOldIdByNewKey(newKey) {
        return this.getKeyByChineseName(newKey);
    }

    /**
     * 确保预设面板存在
     * 如果不存在则创建，存在则不覆盖
     * @param {Object} customPanels - 现有的customPanels对象
     * @returns {Object} 更新后的customPanels对象
     */
    /**
     * 🔧 修复英文字段名称并去重
     *
     * 问题：旧版本中存在两套字段：
     * 1. 中文key字段（如 name: "姓名", key: "姓名"）
     * 2. 英文key字段（如 name: "姓名", key: "name"）
     *
     * 解决方案：
     * 1. 删除所有英文key的字段（保留中文key的字段）
     * 2. 确保每个字段的name都是中文
     *
     * @param {Object} customPanels - 自定义面板配置
     * @returns {Object} 修复后的面板配置
     */
    static fixEnglishFieldNames(customPanels = {}) {
        try {
            console.log('[PresetPanelsManager] 🔧 开始修复英文字段名称并去重...');

            const presets = this.getPresets();
            let fixedCount = 0;
            let removedDuplicates = 0;

            for (const [panelKey, preset] of Object.entries(presets)) {
                const existing = customPanels[panelKey];

                if (!existing || existing.type !== 'preset') {
                    continue;
                }

                console.log(`[PresetPanelsManager] 🔍 检查面板: ${panelKey} (${existing.subItems.length}个字段)`);

                // 创建英文key到中文key的映射
                const englishToChinese = new Map();
                preset.subItems.forEach(item => {
                    englishToChinese.set(item.key.toLowerCase(), item.key);
                });

                // 去重：优先保留中文key的字段
                const fixedSubItems = [];
                const seenNames = new Map(); // name -> 字段对象

                existing.subItems.forEach(item => {
                    const itemName = item.name;
                    const itemKey = item.key;

                    // 检查是否已经有相同name的字段
                    if (seenNames.has(itemName)) {
                        const existingItem = seenNames.get(itemName);

                        // 判断哪个字段应该保留
                        const isCurrentChinese = /[\u4e00-\u9fa5]/.test(itemKey);
                        const isExistingChinese = /[\u4e00-\u9fa5]/.test(existingItem.key);

                        if (isCurrentChinese && !isExistingChinese) {
                            // 当前字段是中文key，已存在的是英文key，替换
                            console.log(`[PresetPanelsManager] � 替换英文key字段: "${itemName}" (${existingItem.key} -> ${itemKey})`);
                            seenNames.set(itemName, item);
                            // 从fixedSubItems中移除旧的
                            const index = fixedSubItems.indexOf(existingItem);
                            if (index > -1) {
                                fixedSubItems.splice(index, 1);
                            }
                            fixedSubItems.push(item);
                            removedDuplicates++;
                        } else if (!isCurrentChinese && isExistingChinese) {
                            // 当前字段是英文key，已存在的是中文key，跳过当前字段
                            console.log(`[PresetPanelsManager] 🗑️ 删除英文key重复字段: "${itemName}" (key: ${itemKey})`);
                            removedDuplicates++;
                        } else {
                            // 两个都是中文key或都是英文key，保留第一个
                            console.log(`[PresetPanelsManager] �️ 删除重复字段: "${itemName}" (key: ${itemKey})`);
                            removedDuplicates++;
                        }
                    } else {
                        // 第一次遇到这个name，添加
                        seenNames.set(itemName, item);
                        fixedSubItems.push(item);
                    }
                });

                console.log(`[PresetPanelsManager] 📊 面板 ${panelKey}: ${existing.subItems.length} -> ${fixedSubItems.length} 个字段`);
                existing.subItems = fixedSubItems;
            }

            console.log(`[PresetPanelsManager] ✅ 字段名称修复完成: 删除重复 ${removedDuplicates} 个`);

            return customPanels;

        } catch (error) {
            console.error('[PresetPanelsManager] ❌ 修复英文字段名称失败:', error);
            return customPanels;
        }
    }

    /**
     * 🔧 重构：初始化预设面板（只在首次使用时调用一次）
     *
     * 新架构说明：
     * - 本方法只会在用户首次使用插件时被调用一次
     * - 初始化后，预设面板成为普通的自定义面板，完全由用户控制
     * - 不再自动检查、恢复或更新预设面板
     * - 用户可以自由删除、修改预设面板，不会被自动恢复
     *
     * @param {Object} customPanels - 现有的自定义面板配置
     * @returns {Object} 更新后的自定义面板配置
     */
    static ensurePresetPanels(customPanels = {}) {
        try {
            console.log('[PresetPanelsManager] 🔧 初始化预设面板（首次使用）...');

            // 🔧 首先修复英文字段名称
            this.fixEnglishFieldNames(customPanels);

            const presets = this.getPresets();
            let addedCount = 0;
            let skippedCount = 0;

            for (const [key, preset] of Object.entries(presets)) {
                const existing = customPanels[key];

                if (!existing) {
                    // 不存在，添加预设面板
                    customPanels[key] = JSON.parse(JSON.stringify(preset)); // 深拷贝
                    customPanels[key].userModified = false; // 标记为未修改（保留字段，但不使用）
                    addedCount++;
                    console.log(`[PresetPanelsManager] ✅ 添加预设面板: ${key} (${preset.subItems.length}个字段)`);

                } else {
                    // 已存在，跳过（可能是之前的初始化或用户自己创建的）
                    skippedCount++;
                    console.log(`[PresetPanelsManager] ⏭️ 面板已存在，跳过: ${key}`);
                }
            }

            console.log(`[PresetPanelsManager] ✅ 预设面板初始化完成: 添加 ${addedCount} 个，跳过 ${skippedCount} 个`);

            return customPanels;

        } catch (error) {
            console.error('[PresetPanelsManager] ❌ 确保预设面板失败:', error);
            return customPanels;
        }
    }

    /**
     * 恢复单个预设面板到默认配置
     * @param {string} panelKey - 面板键名
     * @returns {Object} 预设配置对象，如果不是预设面板返回null
     */
    static restorePreset(panelKey) {
        try {
            const presets = this.getPresets();
            
            if (presets[panelKey]) {
                console.log(`[PresetPanelsManager] 🔄 恢复预设面板: ${panelKey}`);
                return JSON.parse(JSON.stringify(presets[panelKey])); // 深拷贝
            } else {
                console.warn(`[PresetPanelsManager] ⚠️ 不是预设面板，无法恢复: ${panelKey}`);
                return null;
            }
            
        } catch (error) {
            console.error('[PresetPanelsManager] ❌ 恢复预设面板失败:', error);
            return null;
        }
    }

    /**
     * 检查是否是预设面板
     * @param {string} panelKey - 面板键名
     * @returns {boolean}
     */
    static isPresetPanel(panelKey) {
        const presets = this.getPresets();
        return presets.hasOwnProperty(panelKey);
    }

    /**
     * 获取所有预设面板的键名列表
     * @returns {Array<string>}
     */
    static getPresetKeys() {
        const presets = this.getPresets();
        return Object.keys(presets);
    }

    /**
     * 获取预设面板的数量
     * @returns {number}
     */
    static getPresetCount() {
        return 15;
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            presetCount: PresetPanelsManager.getPresetCount()
        };
    }
}


