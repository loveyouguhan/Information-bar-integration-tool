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
            console.log('[VariableSystemPrompt] 🚀 检测到生成开始事件');
            console.log('[VariableSystemPrompt] ℹ️ 变量系统功能已废弃，不再注入变量读取提示词');
            
            // 🔧 修复：清除可能存在的旧的变量提示词
            const context = SillyTavern.getContext();
            if (context && context.setExtensionPrompt) {
                context.setExtensionPrompt('information_bar_variable_reader', '', 1, 0);
                console.log('[VariableSystemPrompt] 🧹 已清除变量系统提示词');
            }
            
            this.injectionActive = false;
            
        } catch (error) {
            console.error('[VariableSystemPrompt] ❌ 处理生成开始事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 生成提示词模板 - 简化版，只包含变量读取指令
     */
    async generatePromptTemplate() {
        console.log('[VariableSystemPrompt] 🔄 生成变量系统读取指令...');
        
        return `## 📊 信息栏数据读取指令

**重要：你必须主动读取SillyTavern变量系统中的信息栏数据来保持剧情连贯性！**

**读取方式：**
使用 \`{{getvar::infobar}}\` 获取完整的信息栏数据对象

**说明：**
- 信息栏数据包含了角色、场景、任务、物品等重要剧情信息
- 请在思考和生成回复时参考这些数据，保持剧情连贯性
- 这些数据会自动更新，反映最新的剧情状态`;
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