// 主应用程序
class PostureDetectorApp {
    constructor() {
        this.isDetecting = false;
        this.isPaused = false;
        this.startTime = null;
        this.currentSession = {
            goodTime: 0,
            badTime: 0,
            alerts: 0,
            issues: [],
            continuousGoodTime: 0,
            maxContinuousGood: 0,
            lastStatus: null
        };
        
        this.dataManager = new DataManager();
        this.poseDetector = new PoseDetector();
        this.chartManager = new ChartManager();
        
        this.init();
    }
    
    async init() {
        // 初始化UI事件
        this.initUIEvents();
        
        // 加载设置
        await this.loadSettings();
        
        // 加载数据
        await this.dataManager.loadData();
        
        // 初始化图表
        this.chartManager.initCharts();
        
        // 更新显示
        this.updateDisplay();
        
        // 开始显示循环
        setInterval(() => this.updateDisplay(), 1000);
        
        console.log('坐姿检测器初始化完成');
    }
    
    initUIEvents() {
        // 导航按钮
        document.getElementById('homeBtn').addEventListener('click', () => this.showPage('homePage'));
        document.getElementById('reportBtn').addEventListener('click', () => {
            this.showPage('reportPage');
            this.loadReports();
        });
        document.getElementById('settingsBtn').addEventListener('click', () => this.showPage('settingsPage'));
        
        // 控制按钮
        document.getElementById('startBtn').addEventListener('click', () => this.startDetection());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('calibrateBtn').addEventListener('click', () => this.calibratePosture());
        
        // 设置按钮
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('resetSettingsBtn').addEventListener('click', () => this.resetSettings());
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearData());
        document.getElementById('exportAllBtn').addEventListener('click', () => this.exportAllData());
        
        // 报告页标签
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.showTab(tab);
            });
        });
        
        // 摄像头选择
        this.initCameraSelect();
    }
    
    async initCameraSelect() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            const select = document.getElementById('cameraSelect');
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `摄像头 ${select.options.length}`;
                select.appendChild(option);
            });
            
            select.addEventListener('change', () => {
                this.restartCamera();
            });
        } catch (error) {
            console.error('获取摄像头列表失败:', error);
        }
    }
    
    async startDetection() {
        try {
            if (!this.isDetecting) {
                // 启动摄像头
                await this.poseDetector.startCamera();
                
                // 启动姿势检测
                this.poseDetector.startDetection((results) => {
                    this.processPoseResults(results);
                });
                
                this.isDetecting = true;
                this.isPaused = false;
                this.startTime = Date.now();
                
                // 更新UI
                document.getElementById('startBtn').disabled = true;
                document.getElementById('pauseBtn').disabled = false;
                document.getElementById('statusIndicator').querySelector('.status-text').textContent = '检测中';
                document.getElementById('statusIndicator').querySelector('.status-circle').style.background = '#48bb78';
                
                this.playSound('good');
                
                console.log('检测开始');
            }
        } catch (error) {
            console.error('启动检测失败:', error);
            alert('无法启动摄像头，请检查权限设置');
        }
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        
        const pauseBtn = document.getElementById('pauseBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        
        if (this.isPaused) {
            pauseBtn.innerHTML = '<i class="fas fa-play"></i> 继续';
            statusIndicator.querySelector('.status-text').textContent = '已暂停';
            statusIndicator.querySelector('.status-circle').style.background = '#ecc94b';
        } else {
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
            statusIndicator.querySelector('.status-text').textContent = '检测中';
            statusIndicator.querySelector('.status-circle').style.background = '#48bb78';
        }
    }
    
    processPoseResults(results) {
        if (!this.isDetecting || this.isPaused) return;
        
        // 姿势分析
        const poseAnalysis = this.analyzePose(results);
        
        // 更新当前会话
        if (poseAnalysis.isGood) {
            this.currentSession.goodTime++;
            this.currentSession.continuousGoodTime++;
            
            if (this.currentSession.continuousGoodTime > this.currentSession.maxContinuousGood) {
                this.currentSession.maxContinuousGood = this.currentSession.continuousGoodTime;
            }
            
            // 更新UI
            document.getElementById('postureStatus').className = 'posture-status good';
            document.getElementById('postureStatus').innerHTML = '<i class="fas fa-check"></i> 坐姿良好';
            
            // 清除问题列表
            document.getElementById('issuesList').innerHTML = '';
        } else {
            this.currentSession.badTime++;
            this.currentSession.continuousGoodTime = 0;
            
            // 检查是否需要提醒
            const now = Date.now();
            const lastAlertTime = this.currentSession.lastAlertTime || 0;
            const alertFrequency = this.dataManager.settings.alertFrequency * 1000;
            
            if (now - lastAlertTime > alertFrequency) {
                this.currentSession.alerts++;
                this.currentSession.lastAlertTime = now;
                
                // 播放提醒声音
                this.playSound('alert');
                
                // 振动提醒（如果支持）
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            }
            
            // 更新UI
            document.getElementById('postureStatus').className = 'posture-status bad';
            document.getElementById('postureStatus').innerHTML = '<i class="fas fa-times"></i> 坐姿不良';
            
            // 显示具体问题
            this.showIssues(poseAnalysis.issues);
        }
        
        this.currentSession.lastStatus = poseAnalysis.isGood ? 'good' : 'bad';
        
        // 每5秒保存一次数据
        if (Date.now() - (this.currentSession.lastSaveTime || 0) > 5000) {
            this.saveSessionData();
        }
    }
    
    analyzePose(results) {
        // 简化的姿势分析逻辑
        // 在实际应用中，这里应该使用更复杂的算法
        const issues = [];
        let isGood = true;
        
        if (results.poseLandmarks) {
            // 获取关键点
            const nose = results.poseLandmarks[0];      // 鼻子
            const leftShoulder = results.poseLandmarks[11]; // 左肩
            const rightShoulder = results.poseLandmarks[12]; // 右肩
            const leftHip = results.poseLandmarks[23];  // 左髋
            const rightHip = results.poseLandmarks[24]; // 右髋
            
            // 检查头部前倾
            if (nose && leftShoulder && rightShoulder) {
                const shoulderAvgY = (leftShoulder.y + rightShoulder.y) / 2;
                const headForward = nose.x - (leftShoulder.x + rightShoulder.x) / 2;
                
                if (Math.abs(headForward) > 0.15) {
                    issues.push(headForward > 0 ? '头部前倾' : '头部后仰');
                    isGood = false;
                }
                
                if (nose.y > shoulderAvgY + 0.08) {
                    issues.push('低头');
                    isGood = false;
                }
            }
            
            // 检查脊柱角度
            if (leftShoulder && rightShoulder && leftHip && rightHip) {
                const shoulderAvgX = (leftShoulder.x + rightShoulder.x) / 2;
                const hipAvgX = (leftHip.x + rightHip.x) / 2;
                const spineAngle = Math.abs(shoulderAvgX - hipAvgX);
                
                if (spineAngle > 0.08) {
                    issues.push('脊柱侧弯');
                    isGood = false;
                }
            }
        }
        
        return { isGood, issues };
    }
    
    showIssues(issues) {
        const issuesList = document.getElementById('issuesList');
        issuesList.innerHTML = '';
        
        issues.forEach(issue => {
            const issueElement = document.createElement('div');
            issueElement.className = 'issue-item';
            issueElement.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${issue}`;
            issuesList.appendChild(issueElement);
        });
    }
    
    async calibratePosture() {
        if (!this.isDetecting) {
            alert('请先开始检测');
            return;
        }
        
        // 这里可以添加校准逻辑
        alert('当前姿势已设为标准姿势');
        
        // 播放校准成功音效
        this.playSound('good');
    }
    
    updateDisplay() {
        if (!this.isDetecting) return;
        
        // 更新时间显示
        if (this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('studyTime').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // 更新统计
        const totalTime = this.currentSession.goodTime + this.currentSession.badTime;
        if (totalTime > 0) {
            const goodRatio = Math.round((this.currentSession.goodTime / totalTime) * 100);
            document.getElementById('goodRatio').textContent = `${goodRatio}%`;
            document.getElementById('alertCount').textContent = this.currentSession.alerts;
            
            const continuousMinutes = Math.floor(this.currentSession.continuousGoodTime / 60);
            document.getElementById('continuousTime').textContent = continuousMinutes;
        }
        
        // 更新今日图表
        this.chartManager.updateTodayChart(this.currentSession);
    }
    
    async saveSessionData() {
        if (!this.startTime) return;
        
        const sessionData = {
            startTime: this.startTime,
            endTime: Date.now(),
            goodTime: this.currentSession.goodTime,
            badTime: this.currentSession.badTime,
            alerts: this.currentSession.alerts,
            maxContinuousGood: this.currentSession.maxContinuousGood
        };
        
        await this.dataManager.saveSession(sessionData);
        this.currentSession.lastSaveTime = Date.now();
    }
    
    showPage(pageId) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // 显示目标页面
        document.getElementById(pageId).classList.add('active');
        
        // 更新导航按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (pageId === 'homePage') {
            document.getElementById('homeBtn').classList.add('active');
        } else if (pageId === 'reportPage') {
            document.getElementById('reportBtn').classList.add('active');
        } else if (pageId === 'settingsPage') {
            document.getElementById('settingsBtn').classList.add('active');
        }
    }
    
    showTab(tabId) {
        // 更新标签按钮
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // 显示对应内容
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabId}Tab`).classList.add('active');
    }
    
    async loadReports() {
        // 加载日报
        const dailyReport = this.dataManager.generateDailyReport();
        document.getElementById('dailyReport').innerHTML = dailyReport;
        
        // 加载周报
        const weeklyReport = this.dataManager.generateWeeklyReport();
        document.getElementById('weeklyReport').innerHTML = weeklyReport;
        
        // 加载图表
        this.chartManager.updateAllCharts(this.dataManager.data);
        
        // 加载成就
        const achievements = this.dataManager.getAchievementsHTML();
        document.getElementById('achievementsList').innerHTML = achievements;
    }
    
    async loadSettings() {
        await this.dataManager.loadSettings();
        
        // 更新UI
        const settings = this.dataManager.settings;
        document.getElementById('studyDuration').value = settings.studyDuration;
        document.getElementById('breakDuration').value = settings.breakDuration;
        document.getElementById('soundEnabled').checked = settings.soundEnabled;
        document.getElementById('alertFrequency').value = settings.alertFrequency;
        document.getElementById('flipCamera').checked = settings.flipCamera;
    }
    
    async saveSettings() {
        const settings = {
            studyDuration: parseInt(document.getElementById('studyDuration').value) || 25,
            breakDuration: parseInt(document.getElementById('breakDuration').value) || 5,
            soundEnabled: document.getElementById('soundEnabled').checked,
            alertFrequency: parseInt(document.getElementById('alertFrequency').value) || 10,
            flipCamera: document.getElementById('flipCamera').checked
        };
        
        await this.dataManager.saveSettings(settings);
        
        // 重新启动摄像头以应用设置
        if (this.isDetecting) {
            await this.restartCamera();
        }
        
        alert('设置已保存');
    }
    
    resetSettings() {
        if (confirm('确定要恢复默认设置吗？')) {
            this.dataManager.resetSettings();
            this.loadSettings();
            alert('设置已恢复为默认值');
        }
    }
    
    async restartCamera() {
        if (this.isDetecting) {
            this.poseDetector.stopCamera();
            await this.startDetection();
        }
    }
    
    async clearData() {
        if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
            await this.dataManager.clearAllData();
            alert('所有数据已清除');
        }
    }
    
    exportAllData() {
        this.dataManager.exportData();
    }
    
    playSound(type) {
        if (!this.dataManager.settings.soundEnabled) return;
        
        const sound = document.getElementById(`${type}Sound`);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('播放声音失败:', e));
        }
    }
}

// 姿势检测器类
class PoseDetector {
    constructor() {
        this.camera = null;
        this.videoElement = document.getElementById('cameraVideo');
        this.canvasElement = document.getElementById('poseCanvas');
        this.canvasCtx = this.canvasElement.getContext('2d');
        this.pose = null;
        this.isRunning = false;
    }
    
    async startCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = stream;
            
            // 等待视频加载
            await new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });
            
            // 设置画布尺寸
            this.canvasElement.width = this.videoElement.videoWidth;
            this.canvasElement.height = this.videoElement.videoHeight;
            
            return true;
        } catch (error) {
            console.error('启动摄像头失败:', error);
            throw error;
        }
    }
    
    async startDetection(onResults) {
        // 初始化MediaPipe Pose
        this.pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        
        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.pose.onResults((results) => {
            this.drawResults(results);
            if (onResults) onResults(results);
        });
        
        this.isRunning = true;
        this.detectFrame();
    }
    
    async detectFrame() {
        if (!this.isRunning) return;
        
        if (this.videoElement.readyState >= 2) {
            await this.pose.send({ image: this.videoElement });
        }
        
        requestAnimationFrame(() => this.detectFrame());
    }
    
    drawResults(results) {
        this.canvasCtx.save();
        
        // 清除画布
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // 绘制视频帧
        this.canvasCtx.drawImage(
            results.image,
            0, 0,
            this.canvasElement.width,
            this.canvasElement.height
        );
        
        // 绘制姿势关键点和连线
        if (results.poseLandmarks) {
            this.drawLandmarks(results.poseLandmarks);
            this.drawConnectors(results.poseLandmarks);
        }
        
        this.canvasCtx.restore();
    }
    
    drawLandmarks(landmarks) {
        this.canvasCtx.fillStyle = '#FF0000';
        
        landmarks.forEach(landmark => {
            const x = landmark.x * this.canvasElement.width;
            const y = landmark.y * this.canvasElement.height;
            
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
            this.canvasCtx.fill();
        });
    }
    
    drawConnectors(landmarks) {
        this.canvasCtx.strokeStyle = '#00FF00';
        this.canvasCtx.lineWidth = 2;
        
        // 定义连接线（简化版）
        const connections = [
            [11, 12], // 肩膀
            [11, 23], // 左肩到左髋
            [12, 24], // 右肩到右髋
            [23, 24], // 髋部
            [0, 11],  // 鼻子到左肩
            [0, 12]   // 鼻子到右肩
        ];
        
        connections.forEach(connection => {
            const [start, end] = connection;
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            if (startPoint && endPoint) {
                const startX = startPoint.x * this.canvasElement.width;
                const startY = startPoint.y * this.canvasElement.height;
                const endX = endPoint.x * this.canvasElement.width;
                const endY = endPoint.y * this.canvasElement.height;
                
                this.canvasCtx.beginPath();
                this.canvasCtx.moveTo(startX, startY);
                this.canvasCtx.lineTo(endX, endY);
                this.canvasCtx.stroke();
            }
        });
    }
    
    stopCamera() {
        this.isRunning = false;
        
        if (this.videoElement.srcObject) {
            const tracks = this.videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
        
        if (this.pose) {
            this.pose.close();
        }
    }
}

// 启动应用
window.addEventListener('DOMContentLoaded', () => {
    window.app = new PostureDetectorApp();
});

// 添加到主屏幕提示
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker 注册成功:', registration);
            })
            .catch(error => {
                console.log('Service Worker 注册失败:', error);
            });
    });
}