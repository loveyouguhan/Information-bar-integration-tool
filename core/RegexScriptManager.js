/**
 * RegexScriptManager.js - 正则表达式脚本管理器
 * 
 * 功能特性:
 * - 管理自定义正则表达式脚本的CRUD操作
 * - 兼容SillyTavern正则表达式系统
 * - 支持导入SillyTavern的正则表达式文件
 * - 支持获取当前SillyTavern内的正则表达式
 * - 脚本启用/禁用管理
 * - 脚本执行顺序管理
 * 
 * @version 1.0.0
 * @author Information Bar Integration Tool Developer
 */

export class RegexScriptManager {
    constructor(dependencies = {}) {
        console.log('[RegexScriptManager] 🔧 正则表达式脚本管理器初始化开始');
        
        // 🔧 依赖注入
        this.configManager = dependencies.configManager || window.SillyTavernInfobar?.modules?.configManager;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        
        // 正则表达式脚本存储
        this.scripts = new Map(); // scriptId -> scriptData
        this.scriptOrder = []; // 执行顺序数组
        
        // SillyTavern正则表达式API引用
        this.sillyTavernRegexAPI = null;
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.addScript = this.addScript.bind(this);
        this.updateScript = this.updateScript.bind(this);
        this.deleteScript = this.deleteScript.bind(this);
        this.getScript = this.getScript.bind(this);
        this.getAllScripts = this.getAllScripts.bind(this);
        
        console.log('[RegexScriptManager] 📊 正则表达式脚本管理器构造完成');
    }
    
    /**
     * 初始化正则表达式脚本管理器
     */
    async init() {
        try {
            console.log('[RegexScriptManager] 🚀 开始初始化正则表达式脚本管理器...');
            
            // 检测SillyTavern正则表达式API
            this.detectSillyTavernRegexAPI();
            
            // 加载已保存的正则表达式脚本
            await this.loadScripts();
            
            // 🆕 加载内置默认正则脚本（如果不存在）
            await this.loadBuiltInScripts();
            
            // 监听事件
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('[RegexScriptManager] ✅ 正则表达式脚本管理器初始化完成');
            console.log('[RegexScriptManager] 📊 当前脚本数量:', this.scripts.size);
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }
    
    /**
     * 检测SillyTavern正则表达式API
     */
    detectSillyTavernRegexAPI() {
        try {
            console.log('[RegexScriptManager] 🔍 检测SillyTavern正则表达式API...');
            
            // 方法1: 检查全局上下文
            const context = window.SillyTavern?.getContext?.();
            if (context) {
                // SillyTavern的正则表达式相关API通常在以下位置
                if (context.getRegexedString || context.power_user?.regex_placement) {
                    console.log('[RegexScriptManager] ✅ 找到SillyTavern正则表达式API (上下文)');
                    this.sillyTavernRegexAPI = {
                        context: context,
                        hasAPI: true
                    };
                    return;
                }
            }
            
            // 方法2: 检查全局对象
            if (window.getRegexedString) {
                console.log('[RegexScriptManager] ✅ 找到SillyTavern正则表达式API (全局)');
                this.sillyTavernRegexAPI = {
                    getRegexedString: window.getRegexedString,
                    hasAPI: true
                };
                return;
            }
            
            // 方法3: 检查扩展系统
            if (window.extensions?.regex) {
                console.log('[RegexScriptManager] ✅ 找到SillyTavern正则表达式API (扩展)');
                this.sillyTavernRegexAPI = {
                    extension: window.extensions.regex,
                    hasAPI: true
                };
                return;
            }
            
            console.log('[RegexScriptManager] ⚠️ 未找到SillyTavern正则表达式API，将使用独立模式');
            this.sillyTavernRegexAPI = {
                hasAPI: false
            };
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 检测SillyTavern正则表达式API失败:', error);
            this.sillyTavernRegexAPI = {
                hasAPI: false,
                error: error.message
            };
        }
    }
    
    /**
     * 加载已保存的正则表达式脚本
     */
    async loadScripts() {
        try {
            console.log('[RegexScriptManager] 📂 加载正则表达式脚本...');
            
            // 从配置管理器加载
            const savedScripts = await this.configManager?.getConfig('regexScripts') || {};
            const savedOrder = await this.configManager?.getConfig('regexScriptOrder') || [];
            
            // 恢复脚本数据
            for (const [scriptId, scriptData] of Object.entries(savedScripts)) {
                this.scripts.set(scriptId, scriptData);
            }
            
            // 恢复执行顺序
            this.scriptOrder = savedOrder.filter(id => this.scripts.has(id));
            
            console.log('[RegexScriptManager] ✅ 脚本加载完成，数量:', this.scripts.size);
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 加载脚本失败:', error);
            throw error;
        }
    }

    /**
     * 🆕 加载内置默认正则脚本
     */
    async loadBuiltInScripts() {
        try {
            console.log('[RegexScriptManager] 📦 加载内置默认正则脚本...');

            // 内置默认脚本：过滤思考标签
            const builtInScript = {
                scriptName: "默认正则表达式（过滤思考标签）",
                description: "系统内置：过滤AI输出中的思考过程标签，包括<thinking>、<aiThinkProcess>、<think>、<ai_memory_summary>、<infobar_data>等",
                enabled: true,
                findRegex: "<thinking>[\\s\\S]*?</thinking>|<aiThinkProcess>[\\s\\S]*?</aiThinkProcess>|<infobar_data>[\\s\\S]*?</infobar_data>|<ai_memory_summary>[\\s\\S]*?</ai_memory_summary>|<think>[\\s\\S]*?</think>",
                replaceString: "",
                trimStrings: false,
                placement: ["INPUT", "OUTPUT"],
                run: "AI_OUTPUT",
                substituteRegex: true
            };

            // 检查是否已经存在同名脚本
            const existingScript = Array.from(this.scripts.values()).find(
                script => script.scriptName === builtInScript.scriptName
            );

            if (existingScript) {
                console.log('[RegexScriptManager] ℹ️ 内置脚本已存在，跳过加载');
                return;
            }

            // 添加内置脚本
            const scriptId = `builtin-filter-tags-${Date.now()}`;
            const fullScriptData = {
                id: scriptId,
                scriptName: builtInScript.scriptName,
                description: builtInScript.description,
                enabled: builtInScript.enabled,
                findRegex: builtInScript.findRegex,
                replaceString: builtInScript.replaceString,
                trimStrings: builtInScript.trimStrings,
                placement: builtInScript.placement,
                run: builtInScript.run,
                substituteRegex: builtInScript.substituteRegex,
                builtIn: true, // 标记为内置脚本
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // 保存脚本
            this.scripts.set(scriptId, fullScriptData);
            this.scriptOrder.unshift(scriptId); // 放在最前面，优先执行

            // 持久化
            await this.saveScripts();

            console.log('[RegexScriptManager] ✅ 内置默认正则脚本已加载:', scriptId);

        } catch (error) {
            console.error('[RegexScriptManager] ❌ 加载内置脚本失败:', error);
            // 不抛出错误，允许系统继续运行
        }
    }
    
    /**
     * 保存正则表达式脚本
     */
    async saveScripts() {
        try {
            console.log('[RegexScriptManager] 💾 保存正则表达式脚本...');
            
            // 转换Map为对象
            const scriptsObject = {};
            for (const [scriptId, scriptData] of this.scripts.entries()) {
                scriptsObject[scriptId] = scriptData;
            }
            
            // 保存到配置管理器
            await this.configManager?.setConfig('regexScripts', scriptsObject);
            await this.configManager?.setConfig('regexScriptOrder', this.scriptOrder);
            
            console.log('[RegexScriptManager] ✅ 脚本保存完成');
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 保存脚本失败:', error);
            throw error;
        }
    }
    
    /**
     * 添加正则表达式脚本
     */
    async addScript(scriptData) {
        try {
            console.log('[RegexScriptManager] ➕ 添加正则表达式脚本:', scriptData.scriptName);
            
            // 验证脚本数据
            this.validateScript(scriptData);
            
            // 生成脚本ID
            const scriptId = this.generateScriptId(scriptData.scriptName);
            
            // 创建完整的脚本对象
            const fullScriptData = {
                id: scriptId,
                scriptName: scriptData.scriptName,
                description: scriptData.description || '',
                enabled: scriptData.enabled !== false, // 默认启用
                findRegex: scriptData.findRegex,
                replaceString: scriptData.replaceString || '',
                trimStrings: scriptData.trimStrings !== false, // 默认true
                placement: scriptData.placement || ['INPUT'], // 默认INPUT
                run: scriptData.run || 'AI_OUTPUT', // 默认AI_OUTPUT
                substituteRegex: scriptData.substituteRegex !== false, // 默认true
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            // 保存脚本
            this.scripts.set(scriptId, fullScriptData);
            this.scriptOrder.push(scriptId);
            
            // 持久化
            await this.saveScripts();
            
            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('regex:script:added', {
                    scriptId,
                    scriptData: fullScriptData
                });
            }
            
            console.log('[RegexScriptManager] ✅ 脚本添加成功:', scriptId);
            return scriptId;
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 添加脚本失败:', error);
            throw error;
        }
    }
    
    /**
     * 更新正则表达式脚本
     */
    async updateScript(scriptId, updates) {
        try {
            console.log('[RegexScriptManager] 🔄 更新正则表达式脚本:', scriptId);
            
            // 检查脚本是否存在
            if (!this.scripts.has(scriptId)) {
                throw new Error(`脚本不存在: ${scriptId}`);
            }
            
            // 获取现有脚本
            const existingScript = this.scripts.get(scriptId);
            
            // 合并更新
            const updatedScript = {
                ...existingScript,
                ...updates,
                id: scriptId, // 保持ID不变
                updatedAt: Date.now()
            };
            
            // 验证更新后的脚本
            this.validateScript(updatedScript);
            
            // 保存更新
            this.scripts.set(scriptId, updatedScript);
            await this.saveScripts();
            
            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('regex:script:updated', {
                    scriptId,
                    scriptData: updatedScript
                });
            }
            
            console.log('[RegexScriptManager] ✅ 脚本更新成功:', scriptId);
            return updatedScript;
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 更新脚本失败:', error);
            throw error;
        }
    }
    
    /**
     * 删除正则表达式脚本
     */
    async deleteScript(scriptId) {
        try {
            console.log('[RegexScriptManager] 🗑️ 删除正则表达式脚本:', scriptId);
            
            // 检查脚本是否存在
            if (!this.scripts.has(scriptId)) {
                throw new Error(`脚本不存在: ${scriptId}`);
            }
            
            // 删除脚本
            const deletedScript = this.scripts.get(scriptId);
            this.scripts.delete(scriptId);
            
            // 从执行顺序中删除
            this.scriptOrder = this.scriptOrder.filter(id => id !== scriptId);
            
            // 持久化
            await this.saveScripts();
            
            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('regex:script:deleted', {
                    scriptId,
                    scriptData: deletedScript
                });
            }
            
            console.log('[RegexScriptManager] ✅ 脚本删除成功:', scriptId);
            return deletedScript;
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 删除脚本失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取单个正则表达式脚本
     */
    getScript(scriptId) {
        return this.scripts.get(scriptId);
    }
    
    /**
     * 获取所有正则表达式脚本
     */
    getAllScripts() {
        // 按执行顺序返回
        return this.scriptOrder
            .map(id => this.scripts.get(id))
            .filter(script => script !== undefined);
    }
    
    /**
     * 获取已启用的脚本
     */
    getEnabledScripts() {
        return this.getAllScripts().filter(script => script.enabled);
    }
    
    /**
     * 启用/禁用脚本
     */
    async toggleScript(scriptId, enabled) {
        return await this.updateScript(scriptId, { enabled });
    }
    
    /**
     * 更新脚本执行顺序
     */
    async updateScriptOrder(newOrder) {
        try {
            console.log('[RegexScriptManager] 🔄 更新脚本执行顺序');
            
            // 验证顺序数组
            if (!Array.isArray(newOrder)) {
                throw new Error('执行顺序必须是数组');
            }
            
            // 验证所有ID都存在
            for (const scriptId of newOrder) {
                if (!this.scripts.has(scriptId)) {
                    throw new Error(`脚本不存在: ${scriptId}`);
                }
            }
            
            // 更新顺序
            this.scriptOrder = newOrder;
            await this.saveScripts();
            
            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('regex:order:updated', {
                    order: newOrder
                });
            }
            
            console.log('[RegexScriptManager] ✅ 脚本执行顺序更新成功');
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 更新脚本执行顺序失败:', error);
            throw error;
        }
    }
    
    /**
     * 从SillyTavern导入正则表达式脚本
     */
    async importFromSillyTavern() {
        try {
            console.log('[RegexScriptManager] 📥 从SillyTavern导入正则表达式脚本...');
            
            // 🔧 修复：直接调用getSillyTavernRegexScripts，不检查hasAPI标志
            // getSillyTavernRegexScripts已经改进，可以从多个位置获取脚本
            const sillyTavernScripts = await this.getSillyTavernRegexScripts();
            
            if (!sillyTavernScripts || sillyTavernScripts.length === 0) {
                console.log('[RegexScriptManager] ℹ️ SillyTavern中没有可导入的正则表达式脚本');
                console.log('[RegexScriptManager] 💡 提示：您可以先在SillyTavern中创建正则表达式，或直接在本工具中创建新脚本');
                // 返回空数组而不是抛出错误
                return [];
            }
            
            // 导入每个脚本
            const importedIds = [];
            const failedScripts = [];
            
            for (const script of sillyTavernScripts) {
                try {
                    // 验证脚本格式
                    if (!script.scriptName || !script.findRegex) {
                        console.warn('[RegexScriptManager] ⚠️ 跳过无效脚本:', script);
                        failedScripts.push({ script, reason: '缺少必要字段' });
                        continue;
                    }
                    
                    // 🔧 格式转换：将SillyTavern格式转换为我们的格式
                    const convertedScript = this.convertSillyTavernScript(script);
                    
                    const scriptId = await this.addScript(convertedScript);
                    importedIds.push(scriptId);
                    console.log('[RegexScriptManager] ✅ 导入脚本成功:', script.scriptName);
                } catch (error) {
                    console.error('[RegexScriptManager] ⚠️ 导入脚本失败:', script.scriptName || 'unknown', error);
                    failedScripts.push({ script, reason: error.message });
                }
            }
            
            console.log('[RegexScriptManager] 📊 导入统计:', {
                total: sillyTavernScripts.length,
                success: importedIds.length,
                failed: failedScripts.length
            });
            
            if (failedScripts.length > 0) {
                console.warn('[RegexScriptManager] ⚠️ 部分脚本导入失败:', failedScripts);
            }
            
            return importedIds;
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 从SillyTavern导入过程异常:', error);
            throw error;
        }
    }
    
    /**
     * 转换SillyTavern正则表达式格式为我们的格式
     */
    convertSillyTavernScript(sillyScript) {
        console.log('[RegexScriptManager] 🔄 转换脚本格式:', sillyScript.scriptName);
        
        // SillyTavern的placement数字映射：
        // 0 = INPUT (发送前)
        // 1 = OUTPUT (接收后)  
        // 2 = BOTH (两者都应用)
        const placementMap = {
            0: ['INPUT'],
            1: ['OUTPUT'],
            2: ['INPUT', 'OUTPUT']
        };
        
        // 转换placement
        let placement = ['INPUT']; // 默认INPUT
        if (Array.isArray(sillyScript.placement)) {
            const placementSet = new Set();
            sillyScript.placement.forEach(num => {
                const mapped = placementMap[num];
                if (mapped) {
                    mapped.forEach(p => placementSet.add(p));
                }
            });
            placement = Array.from(placementSet);
        }
        
        // 🔧 修复：处理findRegex中的正则表达式标志
        let findRegex = sillyScript.findRegex;
        // 如果findRegex以/开头和/结尾并带标志，需要去掉
        const regexMatch = findRegex.match(/^\/(.+)\/([gimsuvy]*)$/);
        if (regexMatch) {
            findRegex = regexMatch[1];
            console.log('[RegexScriptManager] 🔧 移除正则表达式字面量语法:', regexMatch[0], '->', findRegex);
        }
        
        return {
            scriptName: sillyScript.scriptName,
            description: sillyScript.description || `从SillyTavern导入：${sillyScript.scriptName}`,
            enabled: !sillyScript.disabled, // SillyTavern使用disabled字段
            findRegex: findRegex,
            replaceString: sillyScript.replaceString || '',
            trimStrings: Array.isArray(sillyScript.trimStrings) ? sillyScript.trimStrings.length > 0 : true,
            placement: placement,
            run: 'AI_OUTPUT', // 默认AI_OUTPUT
            substituteRegex: sillyScript.substituteRegex !== false // 默认true
        };
    }
    
    /**
     * 获取SillyTavern的正则表达式脚本
     */
    async getSillyTavernRegexScripts() {
        try {
            console.log('[RegexScriptManager] 🔍 获取SillyTavern正则表达式脚本...');
            
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.log('[RegexScriptManager] ⚠️ SillyTavern上下文不可用');
                return [];
            }
            
            let scripts = [];
            
            // 方法1: 从power_user配置中获取
            if (context.power_user?.regex_placement && Array.isArray(context.power_user.regex_placement)) {
                scripts = context.power_user.regex_placement;
                console.log('[RegexScriptManager] 📊 从power_user.regex_placement找到', scripts.length, '个脚本');
            }
            
            // 方法2: 从扩展设置中获取
            if (scripts.length === 0 && context.extensionSettings) {
                const regexExt = context.extensionSettings['regex'] || context.extensionSettings['regex-scripts'];
                // 🔧 修复：regexExt本身就是数组，不是对象！
                if (regexExt && Array.isArray(regexExt)) {
                    scripts = regexExt;
                    console.log('[RegexScriptManager] 📊 从extensionSettings.regex找到', scripts.length, '个脚本');
                } else if (regexExt && regexExt.scripts && Array.isArray(regexExt.scripts)) {
                    // 兼容其他可能的格式
                    scripts = regexExt.scripts;
                    console.log('[RegexScriptManager] 📊 从extensionSettings.regex.scripts找到', scripts.length, '个脚本');
                }
            }
            
            // 方法3: 尝试从全局对象获取
            if (scripts.length === 0 && window.regexScripts && Array.isArray(window.regexScripts)) {
                scripts = window.regexScripts;
                console.log('[RegexScriptManager] 📊 从window.regexScripts找到', scripts.length, '个脚本');
            }
            
            console.log('[RegexScriptManager] 📊 最终找到', scripts.length, '个SillyTavern正则表达式脚本');
            return scripts;
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 获取SillyTavern正则表达式脚本失败:', error);
            return [];
        }
    }
    
    /**
     * 导入正则表达式文件
     */
    async importFromFile(file) {
        try {
            console.log('[RegexScriptManager] 📥 从文件导入正则表达式脚本:', file.name);
            
            // 读取文件内容
            const content = await this.readFile(file);
            
            // 解析JSON
            const scriptData = JSON.parse(content);
            
            // 添加脚本
            const scriptId = await this.addScript(scriptData);
            
            console.log('[RegexScriptManager] ✅ 从文件导入成功:', scriptId);
            return scriptId;
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 从文件导入失败:', error);
            throw error;
        }
    }
    
    /**
     * 导出正则表达式脚本为文件
     */
    async exportToFile(scriptId) {
        try {
            console.log('[RegexScriptManager] 📤 导出正则表达式脚本:', scriptId);
            
            const script = this.getScript(scriptId);
            if (!script) {
                throw new Error(`脚本不存在: ${scriptId}`);
            }
            
            // 准备导出数据（移除元数据）
            const exportData = {
                scriptName: script.scriptName,
                description: script.description,
                enabled: script.enabled,
                findRegex: script.findRegex,
                replaceString: script.replaceString,
                trimStrings: script.trimStrings,
                placement: script.placement,
                run: script.run,
                substituteRegex: script.substituteRegex
            };
            
            // 生成文件名
            const fileName = `${this.sanitizeFileName(script.scriptName)}.json`;
            
            // 下载文件
            this.downloadJSON(exportData, fileName);
            
            console.log('[RegexScriptManager] ✅ 导出成功:', fileName);
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 导出失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量导出所有脚本
     */
    async exportAllScripts() {
        try {
            console.log('[RegexScriptManager] 📤 导出所有正则表达式脚本...');
            
            const allScripts = this.getAllScripts();
            
            if (allScripts.length === 0) {
                throw new Error('没有可导出的脚本');
            }
            
            // 准备导出数据
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                scripts: allScripts.map(script => ({
                    scriptName: script.scriptName,
                    description: script.description,
                    enabled: script.enabled,
                    findRegex: script.findRegex,
                    replaceString: script.replaceString,
                    trimStrings: script.trimStrings,
                    placement: script.placement,
                    run: script.run,
                    substituteRegex: script.substituteRegex
                }))
            };
            
            // 生成文件名
            const timestamp = new Date().toISOString().split('T')[0];
            const fileName = `regex-scripts-${timestamp}.json`;
            
            // 下载文件
            this.downloadJSON(exportData, fileName);
            
            console.log('[RegexScriptManager] ✅ 导出所有脚本成功:', allScripts.length, '个');
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 导出所有脚本失败:', error);
            throw error;
        }
    }
    
    /**
     * 应用正则表达式到文本
     */
    applyScript(text, scriptId) {
        try {
            const script = this.getScript(scriptId);
            
            if (!script || !script.enabled) {
                return text;
            }
            
            // 创建正则表达式
            const regex = new RegExp(script.findRegex, script.substituteRegex ? 'g' : '');
            
            // 执行替换
            let result = text.replace(regex, script.replaceString);
            
            // 清理空白
            if (script.trimStrings) {
                result = result.trim();
            }
            
            return result;
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 应用脚本失败:', scriptId, error);
            return text;
        }
    }
    
    /**
     * 应用所有已启用的脚本
     */
    applyAllScripts(text, placement = 'INPUT', run = 'AI_OUTPUT') {
        try {
            let result = text;
            const enabledScripts = this.getEnabledScripts();
            
            // 按顺序应用脚本
            for (const script of enabledScripts) {
                // 检查placement和run是否匹配
                if (script.placement.includes(placement) && script.run === run) {
                    result = this.applyScript(result, script.id);
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('[RegexScriptManager] ❌ 应用所有脚本失败:', error);
            return text;
        }
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        try {
            if (this.eventSystem) {
                // 监听消息发送前事件，应用INPUT placement的脚本
                this.eventSystem.on('message:sending', async (data) => {
                    if (data.message) {
                        data.message = this.applyAllScripts(data.message, 'INPUT', 'USER_INPUT');
                    }
                });
                
                // 监听消息接收后事件，应用OUTPUT placement的脚本
                this.eventSystem.on('message:received', async (data) => {
                    if (data.content) {
                        data.content = this.applyAllScripts(data.content, 'OUTPUT', 'AI_OUTPUT');
                    }
                });
                
                console.log('[RegexScriptManager] 🔗 事件监听器已设置');
            }
        } catch (error) {
            console.error('[RegexScriptManager] ⚠️ 设置事件监听器失败:', error);
        }
    }
    
    /**
     * 验证脚本数据
     */
    validateScript(scriptData) {
        if (!scriptData.scriptName || scriptData.scriptName.trim() === '') {
            throw new Error('脚本名称不能为空');
        }
        
        if (!scriptData.findRegex || scriptData.findRegex.trim() === '') {
            throw new Error('查找正则表达式不能为空');
        }
        
        // 验证正则表达式语法
        try {
            new RegExp(scriptData.findRegex);
        } catch (error) {
            throw new Error(`正则表达式语法错误: ${error.message}`);
        }
        
        return true;
    }
    
    /**
     * 生成脚本ID
     */
    generateScriptId(scriptName) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        const sanitized = scriptName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        return `${sanitized}-${timestamp}-${random}`;
    }
    
    /**
     * 读取文件内容
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
    
    /**
     * 下载JSON文件
     */
    downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
    
    /**
     * 清理文件名
     */
    sanitizeFileName(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[RegexScriptManager] ❌ 错误:', error);
        
        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('regex:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }
    
    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            scriptCount: this.scripts.size,
            enabledScriptCount: this.getEnabledScripts().length,
            hasSillyTavernAPI: this.sillyTavernRegexAPI?.hasAPI || false
        };
    }
}

