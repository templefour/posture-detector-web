// 数据管理器
class DataManager {
    constructor() {
        this.data = {
            sessions: [],
            achievements: [],
            settings: this.getDefaultSettings(),
            version: '1.0.0'
        };
    }
    
    getDefaultSettings() {
        return {
            studyDuration: 25,
            breakDuration: 5,
            soundEnabled: true,
            alertFrequency: 10,
            flipCamera: true,
            calibratedAngle: 90,
            headThreshold: 0.12,
            spineThreshold: 15
        };
    }
    
    async loadData() {
        try {
            const savedData = localStorage.getItem('postureData');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                
                // 合并数据，保留新版本的默认值
                this.data = {
                    ...this.data,
                    ...parsed,
                    settings: {
                        ...this.data.settings,
                        ...(parsed.settings || {})
                    }
                };
                
                console.log('数据加载成功');
            }
        } catch (error) {
            console.error('加载数据失败:', error);
        }
        
        return this.data;
    }
    
    async saveData() {
        try {
            this.data.lastSave = new Date().toISOString();
            localStorage.setItem('postureData', JSON.stringify(this.data));
            console.log('数据保存成功');
        } catch (error) {
            console.error('保存数据失败:', error);
        }
    }
    
    async loadSettings() {
        await this.loadData();
        return this.data.settings;
    }
    
    async saveSettings(settings) {
        this.data.settings = { ...this.data.settings, ...settings };
        await this.saveData();
    }
    
    resetSettings() {
        this.data.settings = this.getDefaultSettings();
        this.saveData();
    }
    
    async saveSession(sessionData) {
        const session = {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            ...sessionData
        };
        
        this.data.sessions.push(session);
        await this.saveData();
        
        // 检查成就
        this.checkAchievements(session);
        
        return session;
    }
    
    checkAchievements(session) {
        const achievements = [];
        
        // 连续良好时间15分钟
        if (session.maxContinuousGood >= 15 * 60) {
            achievements.push(this.unlockAchievement('连续良好时间15分钟', '专注力冠军'));
        }
        
        // 单日提醒次数<10
        const todaySessions = this.getTodaySessions();
        const todayAlerts = todaySessions.reduce((sum, s) => sum + (s.alerts || 0), 0);
        if (todayAlerts < 10) {
            achievements.push(this.unlockAchievement('单日提醒次数<10', '自律之星'));
        }
        
        // 检查其他成就
        this.checkOtherAchievements();
        
        return achievements;
    }
    
    unlockAchievement(key, name) {
        // 检查是否已经解锁
        const existing = this.data.achievements.find(a => a.key === key);
        if (existing) return null;
        
        const achievement = {
            key,
            name,
            date: new Date().toISOString(),
            unlocked: true
        };
        
        this.data.achievements.push(achievement);
        this.saveData();
        
        // 触发成就解锁事件
        this.onAchievementUnlocked(achievement);
        
        return achievement;
    }
    
    onAchievementUnlocked(achievement) {
        // 可以在这里播放音效或显示通知
        console.log('成就解锁:', achievement.name);
        
        // 发送自定义事件
        const event = new CustomEvent('achievement-unlocked', {
            detail: achievement
        });
        window.dispatchEvent(event);
    }
    
    checkOtherAchievements() {
        // 连续3天良好率>70%
        const recentSessions = this.getRecentSessions(3);
        if (recentSessions.length >= 3) {
            const allGood = recentSessions.every(session => {
                const total = (session.goodTime || 0) + (session.badTime || 0);
                if (total === 0) return false;
                const ratio = (session.goodTime || 0) / total;
                return ratio > 0.7;
            });
            
            if (allGood) {
                this.unlockAchievement('连续3天良好率>70%', '坐姿小达人');
            }
        }
        
        // 单日良好率>80%
        const todaySessions = this.getTodaySessions();
        if (todaySessions.length > 0) {
            const totalGood = todaySessions.reduce((sum, s) => sum + (s.goodTime || 0), 0);
            const totalBad = todaySessions.reduce((sum, s) => sum + (s.badTime || 0), 0);
            const total = totalGood + totalBad;
            
            if (total > 0 && totalGood / total > 0.8) {
                this.unlockAchievement('单日良好率>80%', '完美坐姿日');
            }
        }
    }
    
    getTodaySessions() {
        const today = new Date().toISOString().split('T')[0];
        return this.data.sessions.filter(s => s.date === today);
    }
    
    getRecentSessions(days = 7) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        return this.data.sessions.filter(s => s.timestamp >= cutoff);
    }
    
    generateDailyReport() {
        const todaySessions = this.getTodaySessions();
        
        if (todaySessions.length === 0) {
            return `
                <div class="no-data">
                    <i class="fas fa-calendar-day"></i>
                    <h4>今日无学习记录</h4>
                    <p>开始第一次学习来生成报告吧！</p>
                </div>
            `;
        }
        
        // 计算统计
        const totalTime = todaySessions.reduce((sum, s) => {
            const duration = (s.endTime - s.startTime) / 1000 / 60; // 分钟
            return sum + duration;
        }, 0);
        
        const goodTime = todaySessions.reduce((sum, s) => sum + (s.goodTime || 0), 0) / 60;
        const badTime = todaySessions.reduce((sum, s) => sum + (s.badTime || 0), 0) / 60;
        const totalAlerts = todaySessions.reduce((sum, s) => sum + (s.alerts || 0), 0);
        const maxContinuous = Math.max(...todaySessions.map(s => s.maxContinuousGood || 0)) / 60;
        
        const goodRatio = totalTime > 0 ? Math.round((goodTime / (goodTime + badTime)) * 100) : 0;
        
        // 生成报告HTML
        return `
            <div class="report-stats">
                <div class="stat-row">
                    <span class="stat-label">总学习时间</span>
                    <span class="stat-value">${totalTime.toFixed(1)} 分钟</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">良好坐姿</span>
                    <span class="stat-value">${goodTime.toFixed(1)} 分钟</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">不良坐姿</span>
                    <span class="stat-value">${badTime.toFixed(1)} 分钟</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">坐姿良好率</span>
                    <span class="stat-value">${goodRatio}%</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">提醒次数</span>
                    <span class="stat-value">${totalAlerts} 次</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">最长连续良好</span>
                    <span class="stat-value">${maxContinuous.toFixed(1)} 分钟</span>
                </div>
            </div>
            
            <div class="report-trend">
                <h4>今日趋势</h4>
                <p>${this.getTrendAnalysis(todaySessions)}</p>
            </div>
        `;
    }
    
    generateWeeklyReport() {
        const weeklySessions = this.getRecentSessions(7);
        
        if (weeklySessions.length === 0) {
            return `
                <div class="no-data">
                    <i class="fas fa-chart-line"></i>
                    <h4>本周无学习记录</h4>
                    <p>坚持学习才能看到进步！</p>
                </div>
            `;
        }
        
        // 按日期分组
        const sessionsByDay = {};
        weeklySessions.forEach(session => {
            if (!sessionsByDay[session.date]) {
                sessionsByDay[session.date] = [];
            }
            sessionsByDay[session.date].push(session);
        });
        
        // 计算每日统计
        const days = Object.keys(sessionsByDay).sort();
        const dailyStats = days.map(date => {
            const sessions = sessionsByDay[date];
            const goodTime = sessions.reduce((sum, s) => sum + (s.goodTime || 0), 0) / 60;
            const badTime = sessions.reduce((sum, s) => sum + (s.badTime || 0), 0) / 60;
            const totalTime = goodTime + badTime;
            const ratio = totalTime > 0 ? Math.round((goodTime / totalTime) * 100) : 0;
            
            return { date, goodTime, badTime, ratio };
        });
        
        // 生成报告HTML
        let html = `
            <div class="weekly-summary">
                <h4>本周统计</h4>
                <div class="summary-stats">
                    <div class="summary-item">
                        <span class="summary-label">学习天数</span>
                        <span class="summary-value">${days.length} 天</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">平均良好率</span>
                        <span class="summary-value">
                            ${Math.round(dailyStats.reduce((sum, s) => sum + s.ratio, 0) / dailyStats.length)}%
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="daily-breakdown">
                <h4>每日表现</h4>
                <div class="daily-list">
        `;
        
        dailyStats.forEach(stat => {
            const dateObj = new Date(stat.date);
            const dayName = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()];
            const month = dateObj.getMonth() + 1;
            const day = dateObj.getDate();
            
            // 根据良好率选择表情
            let emoji = '😊';
            if (stat.ratio >= 80) emoji = '🏆';
            else if (stat.ratio >= 60) emoji = '👍';
            else if (stat.ratio > 0) emoji = '💪';
            
            html += `
                <div class="daily-item">
                    <div class="daily-date">
                        ${month}/${day} 周${dayName}
                    </div>
                    <div class="daily-ratio">
                        ${emoji} ${stat.ratio}%
                    </div>
                    <div class="daily-time">
                        ${(stat.goodTime + stat.badTime).toFixed(1)}分钟
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
            
            <div class="trend-analysis">
                <h4>趋势分析</h4>
                <p>${this.getWeeklyTrendAnalysis(dailyStats)}</p>
            </div>
        `;
        
        return html;
    }
    
    getTrendAnalysis(sessions) {
        if (sessions.length < 2) return '数据不足，继续学习生成趋势分析';
        
        const latest = sessions[sessions.length - 1];
        const earlier = sessions[0];
        
        const latestGood = latest.goodTime || 0;
        const earlierGood = earlier.goodTime || 0;
        
        if (latestGood > earlierGood * 1.2) {
            return '📈 良好坐姿时间明显增加，进步很大！';
        } else if (latestGood > earlierGood) {
            return '📈 良好坐姿时间有所增加，继续努力！';
        } else if (latestGood < earlierGood) {
            return '📉 良好坐姿时间减少，注意坐姿！';
        } else {
            return '📊 坐姿保持稳定，继续坚持！';
        }
    }
    
    getWeeklyTrendAnalysis(dailyStats) {
        if (dailyStats.length < 3) return '数据不足，请继续学习';
        
        const ratios = dailyStats.map(s => s.ratio);
        const lastThree = ratios.slice(-3);
        
        if (lastThree[0] < lastThree[1] && lastThree[1] < lastThree[2]) {
            return '🎉 连续3天坐姿良好率持续上升，太棒了！';
        }
        
        const avgRatio = Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length);
        
        if (avgRatio >= 70) {
            return '🌟 本周表现优秀，继续保持良好习惯！';
        } else if (avgRatio >= 50) {
            return '👍 本周表现良好，还有提升空间！';
        } else {
            return '💪 本周需要更多关注坐姿，加油改进！';
        }
    }
    
    getAchievementsHTML() {
        if (this.data.achievements.length === 0) {
            return `
                <div class="no-achievements">
                    <i class="fas fa-trophy"></i>
                    <h4>暂无成就</h4>
                    <p>开始学习，解锁第一个成就吧！</p>
                </div>
            `;
        }
        
        let html = '<div class="achievements-grid">';
        
        // 按解锁时间排序
        const sortedAchievements = [...this.data.achievements].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        sortedAchievements.forEach(achievement => {
            const date = new Date(achievement.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            
            html += `
                <div class="achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <div class="achievement-info">
                        <div class="achievement-name">${achievement.name}</div>
                        <div class="achievement-date">${dateStr} 解锁</div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `posture-data-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }
    
    async clearAllData() {
        this.data = {
            sessions: [],
            achievements: [],
            settings: this.getDefaultSettings(),
            version: '1.0.0'
        };
        
        await this.saveData();
    }
}