/**
 * 内容过滤管理器
 * 
 * 负责在内容发送到主API之前应用正则表达式过滤规则：
 * - 隐藏AI记忆总结标签 [AI_MEMORY_SUMMARY][/AI_MEMORY_SUMMARY]
 * - 隐藏AI思考过程标签 <aiThinkProcess></aiThinkProcess>
 * - 隐藏信息栏数据标签 <infobar_data></infobar_data>
 * 
 * 这些内容需要被AI生成（用于内部处理），但不应该被发送回主API
 * 
 * @class ContentFilterManager
 */

export class ContentFilterManager {
    constructor(eventSystem = null) {
        console.log('[ContentFilterManager] 🔧 内容过滤管理器初始化开始');
        
        this.eventSystem = eventSystem;
        
        // 过滤规则配置
        this.filterRules = [
            {
                name: 'AI_MEMORY_SUMMARY',
                description: '隐藏AI记忆总结内容',
                // 匹配 [AI_MEMORY_SUMMARY]...[/AI_MEMORY_SUMMARY]，包括代码块
                patterns: [
                    // 匹配带代码块的格式
                    /```[\s\S]*?\[AI_MEMORY_SUMMARY\][\s\S]*?\[\/AI_MEMORY_SUMMARY\][\s\S]*?```/g,
                    // 匹配不带代码块的格式
                    /\[AI_MEMORY_SUMMARY\][\s\S]*?\[\/AI_MEMORY_SUMMARY\]/g
                ],
                enabled: true,
                filterType: 'INPUT' // INPUT表示在发送到主API前过滤
            },
            {
                name: 'AI_THINK_PROCESS',
                description: '隐藏AI思考过程标签',
                // 匹配 <aiThinkProcess>...</aiThinkProcess>，包括HTML注释
                patterns: [
                    /<aiThinkProcess>[\s\S]*?<\/aiThinkProcess>/g
                ],
                enabled: true,
                filterType: 'INPUT'
            },
            {
                name: 'INFOBAR_DATA',
                description: '隐藏信息栏数据标签',
                // 匹配 <infobar_data>...</infobar_data>，包括HTML注释
                patterns: [
                    /<infobar_data>[\s\S]*?<\/infobar_data>/g
                ],
                enabled: true,
                filterType: 'INPUT'
            }
        ];
        
        // 统计信息
        this.stats = {
            totalFiltered: 0,
            filtersByRule: {}
        };
        
        // 初始化统计
        this.filterRules.forEach(rule => {
            this.stats.filtersByRule[rule.name] = 0;
        });
        
        console.log('[ContentFilterManager] ✅ 内容过滤管理器初始化完成');
        console.log('[ContentFilterManager] 📋 已加载 ' + this.filterRules.length + ' 个过滤规则');
    }
    
    /**
     * 过滤内容 - 应用所有启用的过滤规则
     * @param {string} content - 原始内容
     * @param {string} filterType - 过滤类型 ('INPUT' 表示发送到主API前过滤)
     * @returns {Object} 返回 { filteredContent, hasFiltered, appliedRules }
     */
    filterContent(content, filterType = 'INPUT') {
        try {
            if (!content || typeof content !== 'string') {
                return {
                    filteredContent: content,
                    hasFiltered: false,
                    appliedRules: []
                };
            }
            
            let filteredContent = content;
            const appliedRules = [];
            let hasFiltered = false;
            
            // 应用每个启用的过滤规则
            for (const rule of this.filterRules) {
                if (!rule.enabled || rule.filterType !== filterType) {
                    continue;
                }
                
                let ruleApplied = false;
                const originalLength = filteredContent.length;
                
                // 应用该规则的所有正则表达式模式
                for (const pattern of rule.patterns) {
                    const beforeLength = filteredContent.length;
                    filteredContent = filteredContent.replace(pattern, '');
                    const afterLength = filteredContent.length;
                    
                    if (beforeLength !== afterLength) {
                        ruleApplied = true;
                        console.log(`[ContentFilterManager] 🔒 应用规则 "${rule.name}"，移除了 ${beforeLength - afterLength} 个字符`);
                    }
                }
                
                if (ruleApplied) {
                    appliedRules.push(rule.name);
                    this.stats.filtersByRule[rule.name]++;
                    hasFiltered = true;
                }
            }
            
            // 清理多余的空行
            if (hasFiltered) {
                filteredContent = filteredContent
                    .replace(/\n\s*\n\s*\n/g, '\n\n')  // 多个空行合并为两个
                    .replace(/^\s+|\s+$/g, '')         // 去除首尾空白
                    .trim();
                
                this.stats.totalFiltered++;
                
                console.log('[ContentFilterManager] ✅ 内容过滤完成');
                console.log(`[ContentFilterManager] 📊 原始长度: ${content.length}，过滤后长度: ${filteredContent.length}`);
                console.log(`[ContentFilterManager] 📋 应用的规则: ${appliedRules.join(', ')}`);
            }
            
            return {
                filteredContent,
                hasFiltered,
                appliedRules
            };
            
        } catch (error) {
            console.error('[ContentFilterManager] ❌ 过滤内容时发生错误:', error);
            return {
                filteredContent: content,
                hasFiltered: false,
                appliedRules: [],
                error: error.message
            };
        }
    }
    
    /**
     * 过滤消息内容（在发送到主API之前）
     * @param {string} messageContent - 消息内容
     * @returns {string} 过滤后的消息内容
     */
    filterForMainAPI(messageContent) {
        const result = this.filterContent(messageContent, 'INPUT');
        return result.filteredContent;
    }
    
    /**
     * 检查内容是否包含需要过滤的标签
     * @param {string} content - 内容
     * @returns {Object} 返回 { hasFilterableTags, tags }
     */
    checkForFilterableTags(content) {
        try {
            if (!content || typeof content !== 'string') {
                return { hasFilterableTags: false, tags: [] };
            }
            
            const foundTags = [];
            
            for (const rule of this.filterRules) {
                if (!rule.enabled) continue;
                
                for (const pattern of rule.patterns) {
                    if (pattern.test(content)) {
                        foundTags.push(rule.name);
                        break;
                    }
                }
            }
            
            return {
                hasFilterableTags: foundTags.length > 0,
                tags: foundTags
            };
            
        } catch (error) {
            console.error('[ContentFilterManager] ❌ 检查可过滤标签时发生错误:', error);
            return { hasFilterableTags: false, tags: [] };
        }
    }
    
    /**
     * 启用/禁用过滤规则
     * @param {string} ruleName - 规则名称
     * @param {boolean} enabled - 是否启用
     */
    setRuleEnabled(ruleName, enabled) {
        const rule = this.filterRules.find(r => r.name === ruleName);
        if (rule) {
            rule.enabled = enabled;
            console.log(`[ContentFilterManager] ⚙️ 规则 "${ruleName}" 已${enabled ? '启用' : '禁用'}`);
        } else {
            console.warn(`[ContentFilterManager] ⚠️ 未找到规则 "${ruleName}"`);
        }
    }
    
    /**
     * 获取过滤统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.stats,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats.totalFiltered = 0;
        for (const ruleName in this.stats.filtersByRule) {
            this.stats.filtersByRule[ruleName] = 0;
        }
        console.log('[ContentFilterManager] 📊 统计信息已重置');
    }
    
    /**
     * 获取所有过滤规则
     * @returns {Array} 过滤规则列表
     */
    getRules() {
        return this.filterRules.map(rule => ({
            name: rule.name,
            description: rule.description,
            enabled: rule.enabled,
            filterType: rule.filterType,
            patternCount: rule.patterns.length
        }));
    }
}

