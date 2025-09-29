/**
 * 数据清理工具
 * 用于清理settings.json中的大型数据，将其迁移到独立文件存储
 */

export class DataCleanupTool {
    constructor(unifiedDataCore, eventSystem = null) {
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        
        this.container = null;
        this.isVisible = false;
        this.isScanning = false;
        this.isCleaningUp = false;
        
        console.log('[DataCleanupTool] 🧹 数据清理工具初始化完成');
    }

    /**
     * 显示清理工具界面
     */
    show() {
        if (!this.container) {
            this.createUI();
        }
        
        this.container.style.display = 'block';
        this.isVisible = true;
        
        // 自动扫描
        this.scanData();
    }

    /**
     * 隐藏清理工具界面
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.isVisible = false;
    }

    /**
     * 创建UI界面
     */
    createUI() {
        const div = document.createElement('div');
        div.className = 'data-cleanup-modal';
        div.innerHTML = this.buildHTML();
        document.body.appendChild(div);
        this.container = div;
        
        // 绑定事件
        this.bindEvents();
        
        // 注入样式
        this.injectStyles();
    }

    /**
     * 构建HTML
     */
    buildHTML() {
        return `
            <div class="data-cleanup-overlay">
                <div class="data-cleanup-dialog">
                    <div class="data-cleanup-header">
                        <h3>🧹 数据清理工具</h3>
                        <button class="data-cleanup-close" data-action="close">×</button>
                    </div>
                    
                    <div class="data-cleanup-content">
                        <div class="data-cleanup-description">
                            <p>此工具可以清理settings.json中的大型数据，将AI记忆、缓存等数据迁移到独立文件中，避免settings.json文件过大导致系统卡顿。</p>
                        </div>
                        
                        <div class="data-cleanup-stats">
                            <h4>📊 存储统计</h4>
                            <div class="stats-grid">
                                <div class="stat-item">
                                    <div class="stat-label">Settings.json</div>
                                    <div class="stat-value" id="settings-size">扫描中...</div>
                                    <div class="stat-count" id="settings-count">-</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-label">文件存储</div>
                                    <div class="stat-value" id="files-size">扫描中...</div>
                                    <div class="stat-count" id="files-count">-</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-label">总计</div>
                                    <div class="stat-value" id="total-size">扫描中...</div>
                                    <div class="stat-count" id="total-count">-</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="data-cleanup-problems" id="problems-section" style="display: none;">
                            <h4>⚠️ 发现的问题</h4>
                            <div class="problems-list" id="problems-list"></div>
                        </div>
                        
                        <div class="data-cleanup-actions">
                            <button class="btn btn-secondary" data-action="scan">
                                🔍 重新扫描
                            </button>
                            <button class="btn btn-primary" data-action="cleanup" id="cleanup-btn" disabled>
                                🧹 开始清理
                            </button>
                        </div>
                        
                        <div class="data-cleanup-progress" id="progress-section" style="display: none;">
                            <div class="progress-bar">
                                <div class="progress-fill" id="progress-fill"></div>
                            </div>
                            <div class="progress-text" id="progress-text">准备中...</div>
                        </div>
                        
                        <div class="data-cleanup-log" id="log-section" style="display: none;">
                            <h4>📋 清理日志</h4>
                            <div class="log-content" id="log-content"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
            switch (action) {
                case 'close':
                    this.hide();
                    break;
                case 'scan':
                    this.scanData();
                    break;
                case 'cleanup':
                    this.startCleanup();
                    break;
            }
        });
    }

    /**
     * 扫描数据
     */
    async scanData() {
        if (this.isScanning) return;
        
        try {
            this.isScanning = true;
            this.updateScanButton(true);
            
            console.log('[DataCleanupTool] 🔍 开始扫描数据...');
            
            // 获取存储统计
            const stats = await this.unifiedDataCore.getStorageStats();
            
            if (stats) {
                // 更新统计显示
                document.getElementById('settings-size').textContent = stats.settings.sizeFormatted;
                document.getElementById('settings-count').textContent = `${stats.settings.count} 项`;
                document.getElementById('files-size').textContent = stats.files.sizeFormatted;
                document.getElementById('files-count').textContent = `${stats.files.count} 项`;
                document.getElementById('total-size').textContent = stats.total.sizeFormatted;
                document.getElementById('total-count').textContent = `${stats.total.count} 项`;
                
                // 检查是否需要清理
                await this.checkForProblems(stats);
            }
            
        } catch (error) {
            console.error('[DataCleanupTool] ❌ 扫描数据失败:', error);
            this.showError('扫描失败: ' + error.message);
        } finally {
            this.isScanning = false;
            this.updateScanButton(false);
        }
    }

    /**
     * 检查问题
     */
    async checkForProblems(stats) {
        const problems = [];

        // 检查settings.json大小
        if (stats.settings.size > 10 * 1024 * 1024) { // 10MB
            problems.push({
                type: 'large-settings',
                severity: 'high',
                message: `Settings.json文件过大 (${stats.settings.sizeFormatted})，可能导致系统卡顿`
            });
        } else if (stats.settings.size > 5 * 1024 * 1024) { // 5MB
            problems.push({
                type: 'large-settings',
                severity: 'medium',
                message: `Settings.json文件较大 (${stats.settings.sizeFormatted})，建议清理`
            });
        }

        // 检查是否有大型数据项
        const allData = this.unifiedDataCore.localStorage.getAll();
        let largeDataCount = 0;

        for (const [key, value] of Object.entries(allData)) {
            if (key.startsWith('__file_ref_')) continue;

            try {
                const dataStr = JSON.stringify(value);
                if (dataStr.length > 100 * 1024) { // 100KB
                    largeDataCount++;
                }
            } catch (error) {
                // 忽略序列化错误
            }
        }

        if (largeDataCount > 0) {
            problems.push({
                type: 'large-data-items',
                severity: 'medium',
                message: `发现 ${largeDataCount} 个大型数据项可以迁移到文件存储`
            });
        }

        // 🆕 检查多聊天记忆数据
        const chatMemoryInfo = await this.checkChatMemoryData();
        if (chatMemoryInfo.totalChats > 5) {
            problems.push({
                type: 'excessive-chat-memory',
                severity: 'medium',
                message: `发现 ${chatMemoryInfo.totalChats} 个聊天的记忆数据 (${chatMemoryInfo.totalSizeFormatted})，建议清理旧聊天数据`
            });
        }

        // 显示问题
        this.displayProblems(problems);

        // 启用/禁用清理按钮
        const cleanupBtn = document.getElementById('cleanup-btn');
        if (problems.length > 0) {
            cleanupBtn.disabled = false;
            cleanupBtn.textContent = `🧹 清理 ${problems.length} 个问题`;
        } else {
            cleanupBtn.disabled = true;
            cleanupBtn.textContent = '✅ 无需清理';
        }
    }

    /**
     * 🆕 检查多聊天记忆数据
     */
    async checkChatMemoryData() {
        try {
            const allData = this.unifiedDataCore.localStorage.getAll();
            const fileRefs = Object.keys(allData).filter(key => key.startsWith('__file_ref_deep_memory_'));

            // 分析聊天ID
            const chatIdPattern = /deep_memory_\w+_(.+)$/;
            const chatIds = new Set();
            let totalSize = 0;

            for (const refKey of fileRefs) {
                const dataKey = refKey.replace('__file_ref_', '');
                const match = dataKey.match(chatIdPattern);

                if (match) {
                    const chatId = match[1];
                    chatIds.add(chatId);

                    // 获取数据大小
                    const refData = allData[refKey];
                    if (refData && refData.size) {
                        totalSize += refData.size;
                    }
                }
            }

            return {
                totalChats: chatIds.size,
                totalSize: totalSize,
                totalSizeFormatted: this.formatBytes(totalSize),
                memoryFiles: fileRefs.length
            };

        } catch (error) {
            console.error('[DataCleanupTool] ❌ 检查聊天记忆数据失败:', error);
            return {
                totalChats: 0,
                totalSize: 0,
                totalSizeFormatted: '0 Bytes',
                memoryFiles: 0
            };
        }
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 显示问题列表
     */
    displayProblems(problems) {
        const problemsSection = document.getElementById('problems-section');
        const problemsList = document.getElementById('problems-list');
        
        if (problems.length === 0) {
            problemsSection.style.display = 'none';
            return;
        }
        
        problemsSection.style.display = 'block';
        
        problemsList.innerHTML = problems.map(problem => `
            <div class="problem-item severity-${problem.severity}">
                <div class="problem-icon">
                    ${problem.severity === 'high' ? '🔴' : problem.severity === 'medium' ? '🟡' : '🟢'}
                </div>
                <div class="problem-message">${problem.message}</div>
            </div>
        `).join('');
    }

    /**
     * 开始清理
     */
    async startCleanup() {
        if (this.isCleaningUp) return;

        try {
            this.isCleaningUp = true;
            this.showProgress(true);
            this.showLog(true);

            this.updateProgress(0, '开始清理...');
            this.addLog('🧹 开始清理数据...');

            let totalCleaned = 0;
            let totalSize = 0;

            // 1. 清理settings.json中的残留数据
            this.updateProgress(20, '清理settings.json...');
            this.addLog('📄 清理settings.json中的残留数据...');

            const settingsResult = await this.unifiedDataCore.cleanupSettingsData();
            totalCleaned += settingsResult.cleanedCount || 0;
            totalSize += settingsResult.migratedSize || 0;

            this.addLog(`✅ Settings清理完成: 迁移了 ${settingsResult.cleanedCount} 个数据项`);

            // 2. 清理多聊天记忆数据
            this.updateProgress(60, '清理多聊天记忆数据...');
            this.addLog('🧠 清理多聊天记忆数据...');

            const chatMemoryResult = await this.unifiedDataCore.cleanupChatMemoryData(5); // 保留最新5个聊天

            if (chatMemoryResult.error) {
                this.addLog(`⚠️ 聊天记忆清理失败: ${chatMemoryResult.error}`);
            } else {
                this.addLog(`✅ 聊天记忆清理完成: 删除了 ${chatMemoryResult.deletedChats} 个旧聊天的数据`);
                this.addLog(`📊 清理了 ${chatMemoryResult.deletedItems} 个记忆数据项和 ${chatMemoryResult.cleanedRefs} 个文件引用`);
                totalCleaned += chatMemoryResult.deletedItems || 0;
            }

            // 3. 清理过期数据
            this.updateProgress(80, '清理过期数据...');
            this.addLog('⏰ 清理过期数据...');

            const expiredResult = await this.unifiedDataCore.fileStorage.cleanupExpiredData();
            this.addLog(`✅ 过期数据清理完成: 删除了 ${expiredResult} 个过期数据项`);
            totalCleaned += expiredResult || 0;

            // 完成
            this.updateProgress(100, '清理完成');
            this.addLog(`🎉 全部清理完成!`);
            this.addLog(`📊 总计清理了 ${totalCleaned} 个数据项，释放了 ${(totalSize / (1024 * 1024)).toFixed(2)}MB 空间`);

            // 重新扫描
            setTimeout(() => {
                this.scanData();
            }, 2000);

        } catch (error) {
            console.error('[DataCleanupTool] ❌ 清理失败:', error);
            this.addLog(`❌ 清理失败: ${error.message}`);
            this.showError('清理失败: ' + error.message);
        } finally {
            this.isCleaningUp = false;
        }
    }

    /**
     * 更新扫描按钮状态
     */
    updateScanButton(scanning) {
        const scanBtn = this.container.querySelector('[data-action="scan"]');
        if (scanBtn) {
            scanBtn.disabled = scanning;
            scanBtn.textContent = scanning ? '🔍 扫描中...' : '🔍 重新扫描';
        }
    }

    /**
     * 显示/隐藏进度条
     */
    showProgress(show) {
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * 更新进度
     */
    updateProgress(percent, text) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        
        if (progressText) {
            progressText.textContent = text;
        }
    }

    /**
     * 显示/隐藏日志
     */
    showLog(show) {
        const logSection = document.getElementById('log-section');
        if (logSection) {
            logSection.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * 添加日志
     */
    addLog(message) {
        const logContent = document.getElementById('log-content');
        if (logContent) {
            const timestamp = new Date().toLocaleTimeString();
            logContent.innerHTML += `<div class="log-entry">[${timestamp}] ${message}</div>`;
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        this.addLog(`❌ ${message}`);
    }

    /**
     * 注入样式
     */
    injectStyles() {
        if (document.getElementById('data-cleanup-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'data-cleanup-styles';
        style.textContent = `
            .data-cleanup-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
            }
            
            .data-cleanup-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .data-cleanup-dialog {
                background: var(--theme-bg-primary, #2a2a2a);
                border: 1px solid var(--theme-border-color, #555);
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            }
            
            .data-cleanup-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid var(--theme-border-color, #555);
            }
            
            .data-cleanup-header h3 {
                margin: 0;
                color: var(--theme-text-primary, #ddd);
            }
            
            .data-cleanup-close {
                background: none;
                border: none;
                color: var(--theme-text-secondary, #999);
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .data-cleanup-close:hover {
                color: var(--theme-text-primary, #ddd);
            }
            
            .data-cleanup-content {
                padding: 20px;
            }
            
            .data-cleanup-description {
                margin-bottom: 20px;
                color: var(--theme-text-secondary, #999);
                line-height: 1.5;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                margin-bottom: 20px;
            }
            
            .stat-item {
                text-align: center;
                padding: 12px;
                background: var(--theme-bg-secondary, #333);
                border-radius: 6px;
                border: 1px solid var(--theme-border-color, #555);
            }
            
            .stat-label {
                font-size: 12px;
                color: var(--theme-text-secondary, #999);
                margin-bottom: 4px;
            }
            
            .stat-value {
                font-size: 16px;
                font-weight: bold;
                color: var(--theme-text-primary, #ddd);
                margin-bottom: 2px;
            }
            
            .stat-count {
                font-size: 11px;
                color: var(--theme-text-secondary, #999);
            }
            
            .problems-list {
                margin-bottom: 20px;
            }
            
            .problem-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                margin-bottom: 8px;
                border-radius: 4px;
                background: var(--theme-bg-secondary, #333);
                border-left: 4px solid;
            }
            
            .problem-item.severity-high {
                border-left-color: #ff4444;
            }
            
            .problem-item.severity-medium {
                border-left-color: #ffaa00;
            }
            
            .problem-item.severity-low {
                border-left-color: #44ff44;
            }
            
            .problem-icon {
                margin-right: 8px;
            }
            
            .problem-message {
                color: var(--theme-text-primary, #ddd);
                font-size: 14px;
            }
            
            .data-cleanup-actions {
                display: flex;
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .data-cleanup-actions .btn {
                flex: 1;
                padding: 10px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            
            .data-cleanup-actions .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .btn-primary {
                background: var(--theme-accent-color, #007bff);
                color: white;
            }
            
            .btn-primary:hover:not(:disabled) {
                background: var(--theme-accent-hover, #0056b3);
            }
            
            .btn-secondary {
                background: var(--theme-bg-secondary, #333);
                color: var(--theme-text-primary, #ddd);
                border: 1px solid var(--theme-border-color, #555);
            }
            
            .btn-secondary:hover:not(:disabled) {
                background: var(--theme-bg-tertiary, #444);
            }
            
            .progress-bar {
                width: 100%;
                height: 8px;
                background: var(--theme-bg-secondary, #333);
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .progress-fill {
                height: 100%;
                background: var(--theme-accent-color, #007bff);
                transition: width 0.3s ease;
                width: 0%;
            }
            
            .progress-text {
                text-align: center;
                color: var(--theme-text-secondary, #999);
                font-size: 12px;
                margin-bottom: 16px;
            }
            
            .log-content {
                background: var(--theme-bg-secondary, #333);
                border: 1px solid var(--theme-border-color, #555);
                border-radius: 4px;
                padding: 12px;
                max-height: 200px;
                overflow-y: auto;
                font-family: monospace;
                font-size: 12px;
            }
            
            .log-entry {
                color: var(--theme-text-secondary, #999);
                margin-bottom: 4px;
                line-height: 1.4;
            }
            
            .log-entry:last-child {
                margin-bottom: 0;
            }
        `;
        
        document.head.appendChild(style);
    }
}
