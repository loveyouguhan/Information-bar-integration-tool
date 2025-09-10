/**
 * 角色扮演对话专用预训练语料库
 * 
 * 专门针对Information bar integration tool的16个面板类型
 * 涵盖角色扮演对话中的各种语义场景和表达方式
 * 
 * @version 1.0.0
 */

(() => {
    'use strict';

    /**
     * 角色扮演专用训练文本集
     */
    const RoleplayCorpus = {
        
        // ===== 个人信息面板 (Personal) =====
        personal: [
            "角色的名字叫做张明，今年25岁，是一名程序员",
            "她有着长长的黑发，眼睛是棕色的，性格开朗活泼",
            "主角身高175cm，体重65kg，拥有健壮的体型",
            "Character's name is Alice, age 28, works as a designer",
            "He has short brown hair, green eyes, and a calm personality",
            "角色的生日是1998年3月15日，血型是O型",
            "她性格内向但很聪明，喜欢读书和绘画",
            "主角来自北京，目前住在上海的公寓里",
            "Character background: grew up in a small town, moved to the city for work",
            "他的兴趣爱好包括摄影、旅行和烹饪美食"
        ],

        // ===== 世界状态面板 (World) =====
        world: [
            "现在是2024年春天，樱花盛开的季节",
            "故事发生在繁华的现代都市，高楼大厦林立",
            "天气晴朗，微风徐徐，温度适宜散步",
            "The time is evening, golden hour with warm sunlight",
            "It's raining heavily, creating a mysterious atmosphere",
            "世界设定在一个魔法与科技并存的奇幻现代",
            "当前季节是秋天，枫叶满地，气候凉爽",
            "时间设定为午夜，月光皎洁，星空璀璨",
            "Location: a cozy coffee shop in the heart of downtown",
            "环境氛围宁静祥和，鸟语花香，远离喧嚣"
        ],

        // ===== 交互对象面板 (Interaction) =====
        interaction: [
            "与朋友李小红进行了深入的谈话，讨论人生理想",
            "见到了多年未见的老同学王大明，彼此都很激动",
            "和陌生人偶然相遇，进行了有趣的对话交流",
            "Met with a mysterious stranger who offered valuable advice",
            "Had a heated argument with colleague about project decisions",
            "与邻居张阿姨聊起了家常，了解了社区最新动态",
            "遇到了一位智慧的老者，从他那里学到了人生哲理",
            "与店员小刘讨论了产品的使用方法和注意事项",
            "Encountered a friendly dog owner during morning walk",
            "和室友讨论了周末的出行计划，达成了一致意见"
        ],

        // ===== 任务状态面板 (Tasks) =====
        tasks: [
            "完成了今天的工作报告，准时提交给上级领导",
            "正在进行的项目已经完成了70%，预计下周结束",
            "需要购买生活用品，包括洗发水、牙膏和面包",
            "Currently working on improving coding skills through online courses",
            "Planning to finish reading the novel by the end of this week",
            "已经预约了下周二的牙医检查，不能忘记",
            "正在准备考试复习材料，制定了详细的学习计划",
            "任务清单包括打扫房间、洗衣服和准备晚餐",
            "Working towards fitness goal: run 5km three times per week",
            "计划这个月内学会弹吉他的三首新歌曲"
        ],

        // ===== 组织关系面板 (Organization) =====
        organization: [
            "在科技公司担任软件工程师，隶属于开发部门",
            "是学生会的成员，负责组织校园文化活动",
            "加入了当地的摄影协会，经常参加外拍活动",
            "Member of the local hiking club, enjoys weekend mountain trips",
            "Works as a team leader in the marketing department",
            "是社区志愿者，定期参加公益服务活动",
            "在读书俱乐部担任副会长，组织每月的读书分享",
            "加入了健身房，每周参加团体课程三次",
            "Part of a gaming guild, collaborates in online adventures",
            "是公司篮球队的一员，周末经常有比赛"
        ],

        // ===== 新闻事件面板 (News) =====
        news: [
            "今天看到新闻说本地将建设新的地铁线路",
            "听说附近的公园即将进行改造升级工程",
            "新闻报道称明天可能会有雷阵雨天气",
            "Local news reported about the new art exhibition opening",
            "Breaking news: traffic changes due to road construction",
            "社区公告显示下周将进行停电维护工作",
            "新闻中提到了经济政策的最新调整方案",
            "听说最喜欢的餐厅即将推出新的菜品系列",
            "Weather forecast shows sunny skies for the weekend",
            "当地电视台报道了慈善活动的成功举办"
        ],

        // ===== 物品清单面板 (Inventory) =====
        inventory: [
            "背包里装着笔记本电脑、充电器和一些文件",
            "口袋里有手机、钱包、钥匙和几颗薄荷糖",
            "桌上放着咖啡杯、签字笔和今天的报纸",
            "Carrying a backpack with books, water bottle, and snacks",
            "In the drawer: old photos, receipts, and a small flashlight",
            "衣柜里挂着几件换季的衣服和一双运动鞋",
            "厨房里有新鲜的蔬菜、鸡蛋和一瓶牛奶",
            "书架上摆放着小说、技术书籍和一些杂志",
            "Desk items include laptop, mouse, keyboard, and desk lamp",
            "冰箱里储存着水果、酸奶和昨天剩下的饭菜"
        ],

        // ===== 能力属性面板 (Abilities) =====
        abilities: [
            "编程技能达到高级水平，精通多种编程语言",
            "拥有出色的沟通能力，善于与人交流合作",
            "具备良好的时间管理能力，工作效率很高",
            "Excellent problem-solving skills developed through experience",
            "Strong analytical thinking and attention to detail",
            "外语能力不错，能够进行基本的英语对话",
            "擅长创意思维，经常能提出新颖的解决方案",
            "具有良好的学习能力，能快速掌握新知识",
            "Leadership qualities shown in team coordination",
            "艺术修养较高，对音乐和绘画有一定的理解"
        ],

        // ===== 剧情进展面板 (Plot) =====
        plot: [
            "故事开始于一个平凡的周一早晨，主角准备上班",
            "转折点出现在主角意外收到神秘信件的时候",
            "经历了一系列挑战后，主角逐渐成长和改变",
            "The story reaches its climax when the truth is revealed",
            "Character development shows growth through adversity",
            "剧情发展到主角必须做出重要选择的关键时刻",
            "故事的高潮部分充满了紧张刺激的情节冲突",
            "经过深思熟虑，主角做出了改变命运的决定",
            "Plot twist reveals hidden connections between characters",
            "故事接近尾声，所有的谜团都得到了解答"
        ],

        // ===== 修炼境界面板 (Cultivation) =====
        cultivation: [
            "修为达到了筑基期中阶，内力深厚稳固",
            "在武学修炼上已经领悟了剑法的精髓要义",
            "经过刻苦练习，终于突破了多年的修炼瓶颈",
            "Spiritual cultivation reached new heights through meditation",
            "Mastery of elemental magic shows significant improvement",
            "丹田内的真气运转更加纯熟顺畅自然",
            "在师父的指导下，学会了高深的心法秘诀",
            "修炼进度稳步提升，距离下一个境界不远了",
            "Combat skills enhanced through rigorous daily practice",
            "感悟了天地间的自然规律，心境更加平和"
        ],

        // ===== 奇幻设定面板 (Fantasy) =====
        fantasy: [
            "这是一个充满魔法的奇幻世界，龙族统治天空",
            "精灵族居住在古老的森林中，与自然和谐共生",
            "魔法师们在高塔中研究着古老的咒语和法术",
            "Ancient prophecies speak of a chosen hero's destiny",
            "Magical creatures roam freely in this enchanted realm",
            "各种种族和平共处，形成了多元化的社会",
            "神秘的魔法物品散落在世界的各个角落",
            "传说中的神器拥有改变世界格局的强大力量",
            "Portals connect different dimensions and parallel worlds",
            "古老的遗迹中隐藏着失落文明的智慧和秘密"
        ],

        // ===== 现代背景面板 (Modern) =====
        modern: [
            "生活在快节奏的现代都市，科技改变了生活方式",
            "智能手机成为了日常生活中不可缺少的工具",
            "公共交通系统发达，地铁和公交覆盖全城",
            "Online shopping and digital payments are commonplace",
            "Social media connects people across the globe",
            "现代医疗技术让人们享有更高的生活质量",
            "环保意识增强，绿色生活成为新的时尚潮流",
            "远程办公和在线教育改变了传统的工作学习模式",
            "Smart homes with automated systems improve daily life",
            "现代艺术和文化呈现出多样化和包容性的特点"
        ],

        // ===== 历史背景面板 (Historical) =====
        historical: [
            "故事发生在明朝中期，商业繁荣民生富足",
            "这是一个战乱频仍的历史时期，民不聊生",
            "在盛唐时代，长安城是世界上最繁华的都市",
            "Medieval Europe was dominated by feudalism and nobility",
            "The Industrial Revolution transformed society completely",
            "古代的丝绸之路连接了东西方文明的交流",
            "科举制度为平民提供了向上流动的机会",
            "历史上的这个时期文化艺术达到了巅峰状态",
            "Ancient civilizations left behind magnificent monuments",
            "传统手工业和农业是当时社会经济的基础"
        ],

        // ===== 魔法系统面板 (Magic) =====
        magic: [
            "火系魔法威力强大，但需要消耗大量的魔力",
            "水系魔法具有治疗和防护的双重功能效果",
            "风系魔法速度奇快，适合用于移动和攻击",
            "Earth magic provides strong defensive capabilities",
            "Lightning magic offers high damage but difficult control",
            "法师需要通过冥想来恢复消耗的精神力量",
            "不同魔法之间存在相克和相生的复杂关系",
            "古老的魔法阵能够放大和聚焦魔法能量",
            "Spell components and ritual preparations are essential",
            "魔法的修炼需要天赋、努力和机遇的完美结合"
        ],

        // ===== 训练记录面板 (Training) =====
        training: [
            "今天完成了30分钟的晨跑训练，感觉状态很好",
            "在健身房进行了力量训练，专注于上肢肌肉",
            "参加了瑜伽课程，学习了几个新的体式动作",
            "Completed swimming practice for 45 minutes today",
            "Martial arts training focused on defensive techniques",
            "进行了专业技能培训，提升了工作相关能力",
            "参加了语言学习班，练习了口语表达技巧",
            "完成了每日的记忆力和注意力训练练习",
            "Music practice session lasted two hours this evening",
            "训练计划包括体能、技能和心理素质三个方面"
        ],

        // ===== 情感表达相关 =====
        emotions: [
            "感到非常开心和兴奋，心情格外明朗",
            "有些担心和焦虑，对未来感到不确定",
            "内心平静安详，找到了内在的平衡",
            "Feeling overwhelmed but determined to push through",
            "Experiencing a mix of nostalgia and hope",
            "感受到了深深的感动，眼中泛起了泪花",
            "心中充满了愧疚和后悔，希望能够弥补",
            "被美好的事物深深震撼，产生了敬畏之情",
            "Feeling proud and accomplished after hard work",
            "体验到了前所未有的成就感和满足感"
        ],

        // ===== 关系动态相关 =====
        relationships: [
            "与朋友的关系更加亲密，彼此更加信任",
            "和家人之间的沟通有了明显的改善",
            "与同事的合作变得更加默契和高效",
            "Romantic relationship is growing stronger each day",
            "Old friendships are being rekindled with joy",
            "师生关系充满了尊重和相互学习的氛围",
            "邻里关系和睦，经常互相帮助和关照",
            "与导师的关系亦师亦友，获益良多",
            "Professional network is expanding through connections",
            "建立了新的友谊，生活变得更加丰富多彩"
        ],

        // ===== 场景描述相关 =====
        scenes: [
            "温馨的咖啡厅里，轻音乐在耳边轻柔地响起",
            "宁静的图书馆中，阳光透过窗户洒在书页上",
            "繁华的商业街道上，人群熙熙攘攘川流不息",
            "Peaceful park setting with children playing nearby",
            "Cozy living room with fireplace crackling warmly",
            "雨后的清晨，空气格外清新，鸟儿在枝头歌唱",
            "深夜的办公室里，只有键盘敲击声在回响",
            "海边的黄昏时分，海浪轻拍着金色的沙滩",
            "Mountain trail surrounded by autumn foliage",
            "古老的建筑群在夕阳下显得格外庄严肃穆"
        ]
    };

    // 导出语料库
    if (typeof window !== 'undefined') {
        window.RoleplayCorpus = RoleplayCorpus;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RoleplayCorpus;
    }

    console.log('[RoleplayCorpus] ✅ 角色扮演专用语料库加载完成');

})();
