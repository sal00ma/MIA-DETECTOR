// ============================================
// MIA DETECTOR - COMPLETE SCRIPT
// ============================================

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', function() {
    console.log('MIA Detector: Initializing application...');
    
    // Initialize all components
    App.init();
    ChartManager.init();
});

// ============================================
// MAIN APPLICATION MODULE
// ============================================
const App = {
    init() {
        console.log('App: Setting up event listeners...');
        this.setupEventListeners();
    },
    
    setupEventListeners() {
        // File upload
        const csvFileInput = document.getElementById('csvFile');
        if (csvFileInput) {
            csvFileInput.addEventListener('change', (e) => {
                MIAProcessor.handleFileUpload(e);
            });
        }
        
        // Load Demo Button
        const loadDemoBtn = document.getElementById('loadDemoBtn');
        if (loadDemoBtn) {
            loadDemoBtn.addEventListener('click', () => {
                MIAProcessor.loadDemoDataset();
            });
        }
        
        // Train Model Button
        const trainBtn = document.getElementById('trainBtn');
        if (trainBtn) {
            trainBtn.addEventListener('click', () => {
                MIAProcessor.trainModel();
            });
        }
        
        // Start Monitoring Button
        const monitorBtn = document.getElementById('monitorBtn');
        if (monitorBtn) {
            monitorBtn.addEventListener('click', () => {
                MIAProcessor.startMonitoring();
            });
        }
        
        // Stop Monitoring Button
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                MIAProcessor.stopMonitoring();
            });
        }
        
        console.log('App: Event listeners setup complete');
    },
    
    updateUI() {
        UIUpdater.updateStats();
        UIUpdater.updateAlerts();
        UIUpdater.updateUsers();
    }
};

// ============================================
// MIA PROCESSOR MODULE (Core Logic)
// ============================================
const MIAProcessor = {
    state: {
        dataset: null,
        datasetInfo: null,
        model: null,
        modelTrained: false,
        isTraining: false,
        isMonitoring: false,
        queryLog: [],
        alerts: [],
        stats: {
            totalQueries: 0,
            totalUsers: 0,
            totalAlerts: 0,
            threatLevel: 'LOW',
            avgConfidence: 0
        },
        userActivity: {},
        realtimeData: [],
        confidenceDistribution: Array(10).fill().map((_, i) => ({
            range: `${i * 10}-${(i + 1) * 10}%`,
            count: 0
        })),
        trainData: null,
        monitorInterval: null
    },
    
    thresholds: {
        maxQueriesPerMinute: 30,
        maxRepeatQueries: 5,
        highConfidenceRatio: 0.70,
        suspiciousScore: 50,
        criticalScore: 75
    },
    
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await this.readFile(file);
            const parsedData = this.parseCSV(text);
            
            this.state.dataset = parsedData.samples;
            this.state.datasetInfo = {
                samples: parsedData.numSamples,
                features: parsedData.numFeatures,
                headers: parsedData.headers
            };
            
            this.resetDetectionState();
            
            // Update UI
            UIUpdater.showFileInfo(file.name, parsedData);
            UIUpdater.enableTraining();
            
            console.log(`✅ Loaded ${parsedData.numSamples} samples with ${parsedData.numFeatures} features`);
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    },
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('File reading failed'));
            reader.readAsText(file);
        });
    },
    
    parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => parseFloat(v.trim()));
            if (values.every(v => !isNaN(v))) {
                data.push(values);
            }
        }
        
        if (data.length === 0) {
            throw new Error('No valid numeric data found in CSV');
        }
        
        const numFeatures = data[0].length - 1;
        
        return {
            samples: data,
            headers: headers,
            numSamples: data.length,
            numFeatures: numFeatures
        };
    },
    
    loadDemoDataset() {
        const data = [];
        for (let i = 0; i < 200; i++) {
            const age = Math.random() * 40 + 30;
            const bmi = Math.random() * 15 + 20;
            const bp = Math.random() * 50 + 100;
            const cholesterol = Math.random() * 100 + 150;
            const glucose = Math.random() * 50 + 70;
            const heartRate = Math.random() * 40 + 60;
            
            const risk = (age > 55 && bmi > 28) ? 1 : 0;
            
            data.push([age, bmi, bp, cholesterol, glucose, heartRate, risk]);
        }
        
        const headers = ['age', 'bmi', 'blood_pressure', 'cholesterol', 'glucose', 'heart_rate', 'disease_risk'];
        
        this.state.dataset = data;
        this.state.datasetInfo = {
            samples: 200,
            features: 6,
            headers: headers
        };
        
        this.resetDetectionState();
        
        UIUpdater.showFileInfo('medical_demo.csv', {
            samples: data,
            headers: headers,
            numSamples: 200,
            numFeatures: 6
        });
        UIUpdater.enableTraining();
        
        console.log('✅ Demo dataset loaded (200 samples, 6 features)');
    },
    
    resetDetectionState() {
        this.state.modelTrained = false;
        this.state.isTraining = false;
        this.state.isMonitoring = false;
        this.state.queryLog = [];
        this.state.alerts = [];
        this.state.stats = {
            totalQueries: 0,
            totalUsers: 0,
            totalAlerts: 0,
            threatLevel: 'LOW',
            avgConfidence: 0
        };
        this.state.userActivity = {};
        this.state.realtimeData = [];
        this.state.confidenceDistribution = Array(10).fill().map((_, i) => ({
            range: `${i * 10}-${(i + 1) * 10}%`,
            count: 0
        }));
        this.state.model = null;
        this.state.trainData = null;
        
        if (this.state.monitorInterval) {
            clearInterval(this.state.monitorInterval);
            this.state.monitorInterval = null;
        }
        
        UIUpdater.resetUI();
    },
    
    trainModel() {
        if (!this.state.dataset) {
            alert('Please upload data first!');
            return;
        }
        
        this.state.isTraining = true;
        UIUpdater.showTrainingStatus();
        
        // Simulate training delay
        setTimeout(() => {
            // Split data: 70% train, 30% test
            const shuffled = [...this.state.dataset].sort(() => Math.random() - 0.5);
            const splitPoint = Math.floor(shuffled.length * 0.7);
            const trainData = shuffled.slice(0, splitPoint);
            const testData = shuffled.slice(splitPoint);
            
            this.state.trainData = {
                trainData,
                testData,
                allData: shuffled
            };
            
            // Train simple neural network
            const numFeatures = this.state.dataset[0].length - 1;
            const learningRate = 0.01;
            const epochs = 100;
            
            let weights = Array(numFeatures).fill(0).map(() => Math.random() * 0.1 - 0.05);
            let bias = 0;
            
            // Training loop
            for (let epoch = 0; epoch < epochs; epoch++) {
                for (let i = 0; i < trainData.length; i++) {
                    const features = trainData[i].slice(0, -1);
                    const label = trainData[i][trainData[i].length - 1];
                    
                    // Forward pass
                    let z = bias;
                    for (let j = 0; j < features.length; j++) {
                        z += weights[j] * features[j];
                    }
                    const prediction = 1 / (1 + Math.exp(-z));
                    
                    // Backward pass
                    const error = prediction - label;
                    bias -= learningRate * error;
                    for (let j = 0; j < weights.length; j++) {
                        weights[j] -= learningRate * error * features[j];
                    }
                }
            }
            
            this.state.model = {
                weights,
                bias,
                numFeatures,
                trained: true
            };
            
            this.state.modelTrained = true;
            this.state.isTraining = false;
            
            UIUpdater.showTrainedStatus(`✓ Trained on ${trainData.length} samples`);
            UIUpdater.enableMonitoring();
            
            console.log('✅ Model trained successfully');
        }, 3000);
    },
    
    predict(features) {
        if (!this.state.model) return 0.5;
        
        let z = this.state.model.bias;
        for (let i = 0; i < features.length; i++) {
            z += this.state.model.weights[i] * features[i];
        }
        
        return 1 / (1 + Math.exp(-z));
    },
    
    hash(features) {
        return features.reduce((acc, val, idx) => acc + val * (idx + 1), 0).toFixed(2);
    },
    
    analyzePatterns(userId, recentQueries) {
        if (recentQueries.length < 10) return { score: 0, triggers: [] };
        
        let score = 0;
        const triggers = [];
        
        // Check repeated queries
        const hashes = recentQueries.map(q => q.inputHash);
        const hashCounts = {};
        hashes.forEach(h => hashCounts[h] = (hashCounts[h] || 0) + 1);
        const maxRepeats = Math.max(...Object.values(hashCounts));
        
        if (maxRepeats >= this.thresholds.maxRepeatQueries) {
            score += 30;
            triggers.push(`Repeated queries: ${maxRepeats}x`);
        }
        
        // Check query rate
        const timeSpan = (recentQueries[recentQueries.length - 1].timestamp - 
                        recentQueries[0].timestamp) / 1000;
        const rate = (recentQueries.length / timeSpan) * 60;
        
        if (rate > this.thresholds.maxQueriesPerMinute) {
            score += 35;
            triggers.push(`High rate: ${rate.toFixed(1)} q/min`);
        }
        
        // Check confidence distribution
        const confidences = recentQueries.map(q => q.confidence);
        const highConfCount = confidences.filter(c => c > 0.75).length;
        const highConfRatio = highConfCount / confidences.length;
        
        if (highConfRatio > this.thresholds.highConfidenceRatio) {
            score += 20;
            triggers.push(`Focused targeting: ${(highConfRatio * 100).toFixed(0)}%`);
        }
        
        // Check bimodal distribution
        const mean = confidences.reduce((a, b) => a + b) / confidences.length;
        const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
        const std = Math.sqrt(variance);
        
        if (std > 0.15) {
            score += 25;
            triggers.push(`Bimodal pattern: σ=${std.toFixed(3)}`);
        }
        
        return { 
            score: Math.min(score, 100), 
            triggers: triggers 
        };
    },
    
    triggerAlert(userId, severity, score, triggers) {
        const alert = {
            id: Date.now(),
            timestamp: new Date(),
            userId,
            severity,
            score,
            triggers
        };
        
        this.state.alerts.unshift(alert);
        if (this.state.alerts.length > 10) {
            this.state.alerts.pop();
        }
        
        this.state.stats.totalAlerts++;
        this.updateThreatLevel(score);
        
        UIUpdater.updateAlertsDisplay();
    },
    
    updateThreatLevel(score) {
        let threatLevel = 'LOW';
        if (score >= 75) threatLevel = 'CRITICAL';
        else if (score >= 60) threatLevel = 'HIGH';
        else if (score >= 40) threatLevel = 'MEDIUM';
        
        this.state.stats.threatLevel = threatLevel;
        UIUpdater.updateThreatLevel(threatLevel);
    },
    
    simulateQuery(userId, features) {
        const confidence = this.predict(features);
        const timestamp = Date.now();
        
        const query = {
            id: this.state.queryLog.length,
            userId,
            features,
            inputHash: this.hash(features),
            confidence,
            timestamp
        };
        
        // Update query log
        this.state.queryLog.push(query);
        
        // Update user activity
        if (!this.state.userActivity[userId]) {
            this.state.userActivity[userId] = { queries: [], totalQueries: 0 };
        }
        
        const user = this.state.userActivity[userId];
        user.queries.push(query);
        user.totalQueries++;
        
        // Analyze patterns
        const recentQueries = user.queries.slice(-30);
        const analysis = this.analyzePatterns(userId, recentQueries);
        user.suspiciousScore = analysis.score;
        
        // Trigger alert if needed
        if (analysis.score >= this.thresholds.criticalScore) {
            this.triggerAlert(userId, 'CRITICAL', analysis.score, analysis.triggers);
        } else if (analysis.score >= this.thresholds.suspiciousScore) {
            this.triggerAlert(userId, 'WARNING', analysis.score, analysis.triggers);
        }
        
        // Update stats
        this.state.stats.totalQueries++;
        this.state.stats.totalUsers = Object.keys(this.state.userActivity).length;
        this.state.stats.avgConfidence = ((this.state.stats.avgConfidence * (this.state.stats.totalQueries - 1)) + confidence) / this.state.stats.totalQueries;
        
        // Update realtime data
        this.state.realtimeData.push({
            query: this.state.realtimeData.length + 1,
            confidence: confidence * 100
        });
        
        if (this.state.realtimeData.length > 50) {
            this.state.realtimeData.shift();
        }
        
        // Update confidence distribution
        const binIndex = Math.floor(confidence * 10);
        this.state.confidenceDistribution[binIndex].count++;
        
        // Update UI
        UIUpdater.updateStats();
        ChartManager.updateCharts(this.state.realtimeData, this.state.confidenceDistribution);
        UIUpdater.updateSuspiciousUsers();
    },
    
    startMonitoring() {
        if (!this.state.modelTrained || !this.state.trainData) {
            alert('Please train model first!');
            return;
        }
        
        this.state.isMonitoring = true;
        UIUpdater.startMonitoringUI();
        
        this.state.monitorInterval = setInterval(() => {
            const userCount = 10;
            const userId = `user_${Math.floor(Math.random() * userCount) + 1}`;
            
            // Some users are attackers
            const isAttacker = userId === 'user_3' || userId === 'user_7';
            
            // Pick random sample from dataset
            const allData = this.state.trainData.allData;
            const randomIndex = Math.floor(Math.random() * allData.length);
            const sample = allData[randomIndex];
            const features = sample.slice(0, -1);
            
            if (isAttacker) {
                // Attacker: query same sample multiple times
                for (let i = 0; i < 3; i++) {
                    this.simulateQuery(userId, features);
                }
            } else {
                // Normal user: single query
                this.simulateQuery(userId, features);
            }
        }, 300);
    },
    
    stopMonitoring() {
        this.state.isMonitoring = false;
        UIUpdater.stopMonitoringUI();
        
        if (this.state.monitorInterval) {
            clearInterval(this.state.monitorInterval);
            this.state.monitorInterval = null;
        }
    },
    
    getSuspiciousUsers() {
        return Object.entries(this.state.userActivity)
            .map(([userId, data]) => ({ 
                userId, 
                score: data.suspiciousScore || 0 
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }
};

// ============================================
// CHART MANAGER MODULE
// ============================================
const ChartManager = {
    confidenceChart: null,
    distributionChart: null,
    
    init() {
        console.log('ChartManager: Initializing charts...');
        this.createCharts();
    },
    
    createCharts() {
        // Confidence Chart
        const confidenceCtx = document.getElementById('confidenceChart');
        if (confidenceCtx) {
            this.confidenceChart = new Chart(confidenceCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Confidence %',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#cbd5e1' }
                        },
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#cbd5e1' }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
        
        // Distribution Chart
        const distributionCtx = document.getElementById('distributionChart');
        if (distributionCtx) {
            this.distributionChart = new Chart(distributionCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: MIAProcessor.state.confidenceDistribution.map(d => d.range),
                    datasets: [{
                        label: 'Count',
                        data: MIAProcessor.state.confidenceDistribution.map(d => d.count),
                        backgroundColor: '#10b981',
                        borderColor: '#0da271',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#cbd5e1' }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#cbd5e1' }
                        }
                    }
                }
            });
        }
    },
    
    updateCharts(realtimeData, distributionData) {
        // Update confidence chart
        if (this.confidenceChart) {
            this.confidenceChart.data.labels = realtimeData.map(d => d.query);
            this.confidenceChart.data.datasets[0].data = realtimeData.map(d => d.confidence);
            this.confidenceChart.update();
        }
        
        // Update distribution chart
        if (this.distributionChart && distributionData) {
            this.distributionChart.data.datasets[0].data = distributionData.map(d => d.count);
            this.distributionChart.update();
        }
    }
};

// ============================================
// UI UPDATER MODULE
// ============================================
const UIUpdater = {
    showFileInfo(fileName, parsedData) {
        document.getElementById('fileName').textContent = fileName;
        document.getElementById('sampleCount').textContent = parsedData.numSamples;
        document.getElementById('featureCount').textContent = parsedData.numFeatures;
        document.getElementById('columnCount').textContent = parsedData.headers.length;
        document.getElementById('headersList').textContent = parsedData.headers.join(', ');
        
        document.getElementById('fileStatus').style.display = 'block';
        document.getElementById('datasetInfo').style.display = 'block';
    },
    
    enableTraining() {
        document.getElementById('trainBtn').disabled = false;
    },
    
    showTrainingStatus() {
        document.getElementById('trainingStatus').style.display = 'block';
        document.getElementById('trainedStatus').style.display = 'none';
    },
    
    showTrainedStatus(message) {
        document.getElementById('trainingStatus').style.display = 'none';
        document.getElementById('trainedStatus').style.display = 'block';
        document.getElementById('trainResult').textContent = message;
        document.getElementById('dashboard').style.display = 'block';
    },
    
    enableMonitoring() {
        document.getElementById('monitorBtn').disabled = false;
    },
    
    startMonitoringUI() {
        document.getElementById('monitorBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'inline-flex';
        document.getElementById('monitorStatus').style.display = 'inline-flex';
    },
    
    stopMonitoringUI() {
        document.getElementById('monitorBtn').style.display = 'inline-flex';
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('monitorStatus').style.display = 'none';
    },
    
    updateStats() {
        const stats = MIAProcessor.state.stats;
        document.getElementById('totalQueries').textContent = stats.totalQueries;
        document.getElementById('activeUsers').textContent = stats.totalUsers;
        document.getElementById('totalAlerts').textContent = stats.totalAlerts;
        document.getElementById('threatLevel').textContent = stats.threatLevel;
        
        // Update threat level color
        const threatLevelEl = document.getElementById('threatLevel');
        switch(stats.threatLevel) {
            case 'CRITICAL': threatLevelEl.style.color = '#ef4444'; break;
            case 'HIGH': threatLevelEl.style.color = '#f97316'; break;
            case 'MEDIUM': threatLevelEl.style.color = '#f59e0b'; break;
            default: threatLevelEl.style.color = '#10b981'; break;
        }
    },
    
    updateThreatLevel(threatLevel) {
        document.getElementById('threatLevel').textContent = threatLevel;
        
        const threatLevelEl = document.getElementById('threatLevel');
        switch(threatLevel) {
            case 'CRITICAL': threatLevelEl.style.color = '#ef4444'; break;
            case 'HIGH': threatLevelEl.style.color = '#f97316'; break;
            case 'MEDIUM': threatLevelEl.style.color = '#f59e0b'; break;
            default: threatLevelEl.style.color = '#10b981'; break;
        }
    },
    
    updateAlertsDisplay() {
        const alerts = MIAProcessor.state.alerts;
        const alertsContainer = document.getElementById('alertsContainer');
        const alertsSection = document.getElementById('alertsSection');
        
        if (alerts.length === 0) {
            alertsSection.style.display = 'none';
            return;
        }
        
        alertsSection.style.display = 'block';
        alertsContainer.innerHTML = '';
        
        alerts.slice(0, 3).forEach(alert => {
            const alertClass = alert.severity === 'CRITICAL' ? 'alert-critical' : 'alert-warning';
            const icon = alert.severity === 'CRITICAL' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
            
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert ${alertClass}`;
            alertDiv.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <i class="fas ${icon}"></i>
                    <strong style="margin-left: 10px; font-size: 1.1rem;">${alert.severity} - ${alert.userId}</strong>
                    <span style="margin-left: auto; opacity: 0.75; font-size: 0.9rem;">
                        ${alert.timestamp.toLocaleTimeString()}
                    </span>
                </div>
                <div style="font-size: 0.9rem;">
                    <p style="margin-bottom: 5px;"><strong>Score:</strong> ${alert.score}/100</p>
                    <p><strong>Triggers:</strong> ${alert.triggers.join(', ')}</p>
                </div>
            `;
            alertsContainer.appendChild(alertDiv);
        });
    },
    
    updateSuspiciousUsers() {
        const users = MIAProcessor.getSuspiciousUsers();
        const container = document.getElementById('suspiciousUsers');
        
        container.innerHTML = '';
        
        users.forEach(({ userId, score }) => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            let barColor = '#f59e0b'; // yellow
            if (score > 75) barColor = '#ef4444';
            else if (score > 50) barColor = '#f97316';
            
            userDiv.innerHTML = `
                <span class="user-name">${userId}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="score-bar">
                        <div class="score-fill" style="width: ${Math.min(score, 100)}%; background: ${barColor};"></div>
                    </div>
                    <span class="score-value" style="color: ${barColor};">${score}</span>
                </div>
            `;
            container.appendChild(userDiv);
        });
    },
    
    resetUI() {
        document.getElementById('trainingStatus').style.display = 'none';
        document.getElementById('trainedStatus').style.display = 'none';
        document.getElementById('monitorBtn').disabled = true;
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('monitorStatus').style.display = 'none';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('alertsSection').style.display = 'none';
    }
};