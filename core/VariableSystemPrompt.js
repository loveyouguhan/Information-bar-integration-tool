/**
 * 变量系统读取提示词模块
 * 
 * 功能：
 * - 为 AI 注入变量系统数据读取指令
 * - 动态生成包含实际数据和规则的提示词
 * - 确保 AI 能够正确访问和遵循信息栏规则
 * - 支持主API和自定义API的统一注入
 * 
 * @class VariableSystemPrompt
 */

export class VariableSystemPrompt {
    constructor(eventSystem) {
        console.log('[VariableSystemPrompt] 🏗️ 构造函数开始');
        
        // 依赖注入
        this.eventSystem = eventSystem;
        
        // SillyTavern上下文
        this.context = null;
        
        // 提示词模板（动态生成）
        this.promptTemplate = null;
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        this.injectionActive = false;
        
        console.log('[VariableSystemPrompt] 🏗️ 构造函数完成');
    }

    /**
     * 初始化变量系统读取提示词
     */
    async init() {
        try {
            console.log('[VariableSystemPrompt] 📊 开始初始化变量系统读取提示词...');
            
            // 获取SillyTavern上下文
            this.context = SillyTavern.getContext();
            
            if (!this.context) {
                throw new Error('无法获取SillyTavern上下文');
            }
            
            // 注册API注入钩子
            await this.registerAPIInjection();
            
            this.initialized = true;
            console.log('[VariableSystemPrompt] ✅ 变量系统读取提示词初始化完成');
            
            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('variable-prompt:initialized', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[VariableSystemPrompt] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 注册API注入钩子
     */
    async registerAPIInjection() {
        try {
            console.log('[VariableSystemPrompt] 🔗 注册API注入钩子...');
            
            // 监听生成开始事件
            this.context.eventSource.on('generation_started', this.handleGenerationStarted.bind(this));
            
            console.log('[VariableSystemPrompt] ✅ API注入钩子注册完成');
            
        } catch (error) {
            console.error('[VariableSystemPrompt] ❌ 注册API注入钩子失败:', error);
            throw error;
        }
    }

    /**
     * 处理生成开始事件
     */
    async handleGenerationStarted(data) {
        try {
            console.log('[VariableSystemPrompt] 🚀 检测到生成开始，检查是否需要注入变量系统读取提示词...');

            // 🔧 修复：检查自定义API模式，避免与主API禁止规则冲突
            const context = SillyTavern.getContext();
            const extensionSettings = context?.extensionSettings;
            const apiConfig = extensionSettings?.['Information bar integration tool']?.apiConfig;
            
            if (apiConfig?.enabled && apiConfig?.apiKey && apiConfig?.model) {
                console.log('[VariableSystemPrompt] 🚫 检测到自定义API模式已启用，跳过主API变量提示词注入');
                console.log('[VariableSystemPrompt] 📊 自定义API提供商:', apiConfig.provider);
                console.log('[VariableSystemPrompt] 📊 自定义API模型:', apiConfig.model);
                console.log('[VariableSystemPrompt] ✅ 避免与主API禁止规则产生冲突');
                
                // 清除之前可能注入的提示词
                if (this.context.setExtensionPrompt) {
                    this.context.setExtensionPrompt('information_bar_variable_reader', '', 1, 0);
                    console.log('[VariableSystemPrompt] 🧹 已清除主API变量提示词');
                }
                return;
            }

            console.log('[VariableSystemPrompt] ✅ 自定义API未启用，继续注入变量系统读取提示词...');
            
            // 动态生成提示词模板
            this.promptTemplate = await this.generatePromptTemplate();
            
            // 注入变量系统读取提示词
            await this.injectVariablePrompt();
            
            this.injectionActive = true;
            console.log('[VariableSystemPrompt] ✅ 变量系统读取提示词注入成功');
            
        } catch (error) {
            console.error('[VariableSystemPrompt] ❌ 处理生成开始事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 生成提示词模板 - 包含完整的输出格式要求
     */
    async generatePromptTemplate() {
        console.log('[VariableSystemPrompt] 🔄 生成包含完整输出格式的指令...');
        
        return `🚨🚨🚨 **CRITICAL MANDATORY INSTRUCTION** 🚨🚨🚨

**STEP 1: EXECUTE IMMEDIATELY BEFORE ANY RESPONSE:**
\`{{getvar::infobar}}\`

**STEP 2: CRITICAL RULE ENFORCEMENT:**
- ⚠️ **TIME FORMAT MUST BE**: "2024/01/15 18点30分" format ONLY (extract from rules you get)
- ⚠️ **NEVER use generic words**: "夜晚", "下午", "晚上" for time fields
- ⚠️ **ALWAYS extract and follow ALL rules from the data you get**

**STEP 3: MANDATORY OUTPUT FORMAT - TWO TAGS REQUIRED:**

**🚨 MUST OUTPUT BOTH TAGS IN THIS EXACT ORDER 🚨**

1. **FIRST TAG - aiThinkProcess (REQUIRED):**
   \`<aiThinkProcess>\`
   \`<!--\`
   \`[Your 5-step analysis process here]\`
   \`-->\`
   \`</aiThinkProcess>\`

2. **SECOND TAG - infobar_data (REQUIRED):**
   \`<infobar_data>\`
   \`<!--\`
   \`[Panel data in XML compact format, following extracted rules]\`
   \`-->\`
   \`</infobar_data>\`

**⚠️ CRITICAL REQUIREMENTS:**
- Both tags MUST be output in EVERY response
- Must be wrapped in <!--  --> comments
- Must follow rules extracted from {{getvar::infobar}}
- aiThinkProcess MUST come first, infobar_data MUST come second

**🚨 FAILURE TO OUTPUT BOTH TAGS = SYSTEM ERROR 🚨**`;
    }

    /**
     * 默认提示词模板（备用）
     */
    getDefaultPromptTemplate() {
        return `## 📊 信息栏数据读取指令
**重要：你必须主动读取SillyTavern变量系统中的信息栏数据来保持剧情连贯性！**
使用 \`{{getvar::infobar}}\` 获取完整的嵌套信息栏对象`;
    }

    /**
     * 注入变量系统读取提示词到API请求
     */
    async injectVariablePrompt() {
        try {
            console.log('[VariableSystemPrompt] 📝 开始注入变量系统读取提示词...');
            
            // 使用SillyTavern的扩展提示词机制
            if (this.context.setExtensionPrompt) {
                // 注入到扩展提示词中，确保无论主API还是自定义API都能接收
                this.context.setExtensionPrompt(
                    'information_bar_variable_reader', 
                    this.promptTemplate,
                    1, // 高优先级
                    0  // 深度为0，确保在最前面
                );
                
                console.log('[VariableSystemPrompt] ✅ 使用SillyTavern内置机制注入变量读取提示词');
            } else {
                console.warn('[VariableSystemPrompt] ⚠️ SillyTavern扩展提示词机制不可用');
            }
            
        } catch (error) {
            console.error('[VariableSystemPrompt] ❌ 注入变量系统读取提示词失败:', error);
            throw error;
        }
    }

    /**
     * 清理变量系统读取提示词
     */
    async clearVariablePrompt() {
        try {
            console.log('[VariableSystemPrompt] 🧹 清理变量系统读取提示词...');
            
            // 清理扩展提示词
            if (this.context.setExtensionPrompt) {
                this.context.setExtensionPrompt('information_bar_variable_reader', '');
                console.log('[VariableSystemPrompt] ✅ 已清理变量读取提示词');
            }
            
            this.injectionActive = false;
            
        } catch (error) {
            console.error('[VariableSystemPrompt] ❌ 清理失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[VariableSystemPrompt] ❌ 错误:', error);

        // 发出错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('variable-prompt:error', {
                error,
                errorCount: this.errorCount,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 获取模块状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            injectionActive: this.injectionActive,
            errorCount: this.errorCount,
            hasPromptTemplate: !!this.promptTemplate
        };
    }
}