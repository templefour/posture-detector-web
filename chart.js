// 图表管理器
class ChartManager {
    constructor() {
        this.charts = {};
    }
    
    initCharts() {
        this.initTrendChart();
        this.initPieChart();
        this.initHourlyChart();
        this.initTodayChart();
    }
    
    initTrendChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '坐姿良好率 (%)',
                    data: [],
                    borderColor: '#4FD1C5',
                    backgroundColor: 'rgba(79, 209, 197, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#4FD1C5'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: value => value + '%'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: context => `良好率: ${context.raw}%`
                        }
                    }
                }
            }
        });
    }
    
    initPieChart() {
        const ctx = document.getElementById('pieChart').getContext('2d');
        
        this.charts.pie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['良好坐姿', '不良坐姿'],
                datasets: [{
                    data: [70, 30],
                    backgroundColor: [
                        '#4FD1C5',
                        '#FC8181'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${percentage}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    initHourlyChart() {
        const ctx = document.getElementById('hourlyChart').getContext('2d');
        
        this.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['9:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
                datasets: [{
                    label: '不良坐姿比例',
                    data: [25, 30, 45, 40, 35, 20],
                    backgroundColor: '#FC8181',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: value => value + '%'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: context => `不良率: ${context.raw}%`
                        }
                    }
                }
            }
        });
    }
    
    initTodayChart() {
        const ctx = document.getElementById('todayChart').getContext('2d');
        
        this.charts.today = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '良好率',
                    data: [],
                    borderColor: '#4FD1C5',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        display: false,
                        beginAtZero: true,
                        max: 100
                    },
                    x: {
                        display: false
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                elements: {
                    line: {
                        tension: 0.4
                    }
                }
            }
        });
    }
    
    updateTodayChart(session) {
        if (!this.charts.today) return;
        
        const chart = this.charts.today;
        const total = session.goodTime + session.badTime;
        
        if (total > 0) {
            const ratio = Math.round((session.goodTime / total) * 100);
            
            // 添加新数据点
            chart.data.labels.push('');
            chart.data.datasets[0].data.push(ratio);
            
            // 保持最近20个数据点
            if (chart.data.labels.length > 20) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }
            
            chart.update('none');
        }
    }
    
    updateAllCharts(data) {
        this.updateTrendChart(data);
        this.updatePieChart(data);
        this.updateHourlyChart(data);
    }
    
    updateTrendChart(data) {
        const recentSessions = this.getRecentSessionsGrouped(data.sessions, 7);
        
        const labels = recentSessions.map(s => {
            const date = new Date(s.date);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
        
        const ratios = recentSessions.map(s => {
            const total = s.goodTime + s.badTime;
            return total > 0 ? Math.round((s.goodTime / total) * 100) : 0;
        });
        
        this.charts.trend.data.labels = labels;
        this.charts.trend.data.datasets[0].data = ratios;
        this.charts.trend.update();
    }
    
    updatePieChart(data) {
        const todaySessions = this.getTodaySessions(data.sessions);
        
        let goodTime = 0;
        let badTime = 0;
        
        todaySessions.forEach(session => {
            goodTime += session.goodTime || 0;
            badTime += session.badTime || 0;
        });
        
        // 转换为分钟
        goodTime = Math.round(goodTime / 60);
        badTime = Math.round(badTime / 60);
        
        // 如果今天没有数据，显示默认数据
        if (goodTime === 0 && badTime === 0) {
            goodTime = 30;
            badTime = 10;
        }
        
        this.charts.pie.data.datasets[0].data = [goodTime, badTime];
        this.charts.pie.update();
    }
    
    updateHourlyChart(data) {
        // 这里可以按小时分析数据
        // 简化版：使用示例数据
        this.charts.hourly.update();
    }
    
    getRecentSessionsGrouped(sessions, days) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const recentSessions = sessions.filter(s => s.timestamp >= cutoff);
        
        // 按日期分组
        const grouped = {};
        recentSessions.forEach(session => {
            if (!grouped[session.date]) {
                grouped[session.date] = {
                    date: session.date,
                    goodTime: 0,
                    badTime: 0
                };
            }
            
            grouped[session.date].goodTime += session.goodTime || 0;
            grouped[session.date].badTime += session.badTime || 0;
        });
        
        // 转换为数组并排序
        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    }
    
    getTodaySessions(sessions) {
        const today = new Date().toISOString().split('T')[0];
        return sessions.filter(s => s.date === today);
    }
}