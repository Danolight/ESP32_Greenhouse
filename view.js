// Configuración
let chart;
let tankSparklineChart;
let lastData = null;
const maxDataPoints = 24;
let sensorDataInterval = 5000;  // Default 5s, updated from backend config
let sensorDataTimeout = null;

window.onload = function() {
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href = '/';
        return;
    }
    
    // Prevent back button from going to login
    history.replaceState(null, null, window.location.href);
    window.addEventListener('popstate', function(event) {
        history.pushState(null, null, window.location.href);
        const isAuth = localStorage.getItem('isAuthenticated');
        if (!isAuth || isAuth !== 'true') {
            window.location.href = '/';
        }
    });
    
    // Initialize theme
    initTheme();
    
    // Start fetching data IMMEDIATELY
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setDemoMode();
    } else {
        fetchSensorData();
    }
    
    // Initialize charts asynchronously
    waitForChart();
};

function waitForChart() {
    if (typeof Chart !== 'undefined') {
        initChart();
        // If data has already arrived, update the UI immediately
        if (lastData) {
            console.log("Charts ready, populating with cached data...");
            updateUI(lastData);
        }
    } else {
        console.log('Esperando a Chart.js...');
        setTimeout(waitForChart, 100);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    localStorage.removeItem('isGuest');
    navigateWithTransition('login.html');
}

function navigateWithTransition(url) {
    document.body.classList.add('page-exiting');
    setTimeout(function() {
        window.location.href = url;
    }, 200);
}

// Theme Management
function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.documentElement.classList.add('dark-theme');
        updateThemeIcon(true, false);
    }
    
    themeToggleBtn.addEventListener('click', function() {
        const willBeDark = !document.body.classList.contains('dark-theme');
        triggerThemeTransition(willBeDark);
    });
}

function triggerThemeTransition(toDark) {
    const overlay = document.getElementById('theme-transition-overlay');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    
    const currentIcon = themeToggleBtn.querySelector('.theme-icon');
    const newIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    newIcon.setAttribute('class', 'theme-icon theme-icon-new');
    newIcon.setAttribute('viewBox', '0 0 24 24');
    newIcon.setAttribute('fill', 'none');
    newIcon.setAttribute('stroke', 'currentColor');
    newIcon.setAttribute('stroke-width', '2');
    
    if (toDark) {
        newIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
        currentIcon.classList.add('sun-setting');
        newIcon.classList.add('moon-rising');
    } else {
        newIcon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
        currentIcon.classList.add('moon-setting');
        newIcon.classList.add('sun-rising');
    }
    
    themeToggleBtn.appendChild(newIcon);
    overlay.classList.add('active');
    
    if (toDark) {
        document.body.classList.add('dark-theme');
        document.documentElement.classList.add('dark-theme');
        document.documentElement.setAttribute('style', 'background-color: #0a0f1e !important;');
        document.body.setAttribute('style', 'background-color: #0a0f1e !important; color: #ffffff !important;');
    } else {
        document.body.classList.remove('dark-theme');
        document.documentElement.classList.remove('dark-theme');
        document.documentElement.removeAttribute('style');
        document.body.removeAttribute('style');
    }
    
    localStorage.setItem('theme', toDark ? 'dark' : 'light');
    
    setTimeout(() => {
        const originalAnimationDuration = chart.options.animation.y.duration;
        chart.options.animation.y.duration = 0;
        chart.update('none');
        setTimeout(() => {
            chart.options.animation.y.duration = originalAnimationDuration;
        }, 100);
    }, 200);
    
    setTimeout(() => {
        overlay.classList.remove('active');
        currentIcon.remove();
        newIcon.classList.remove('moon-rising', 'sun-rising', 'sun-setting', 'moon-setting');
        newIcon.classList.remove('theme-icon-new');
    }, 400);
}

function updateThemeIcon(isDark, animate = false) {
    const themeIcon = document.querySelector('.theme-icon');
    
    if (animate) return;
    
    if (isDark) {
        themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    } else {
        themeIcon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
    }
}

// Chart Initialization
function initChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#9ca3af';
    
    const gradientTemp = ctx.createLinearGradient(0, 0, 0, 400);
    gradientTemp.addColorStop(0, 'rgba(245, 158, 11, 0.5)');
    gradientTemp.addColorStop(1, 'rgba(245, 158, 11, 0.1)');
    const gradientHum = ctx.createLinearGradient(0, 0, 0, 400);
    gradientHum.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradientHum.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
    const gradientSoil = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSoil.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
    gradientSoil.addColorStop(1, 'rgba(16, 185, 129, 0.1)');
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { 
                    label: 'Temp', 
                    borderColor: '#f59e0b', 
                    backgroundColor: gradientTemp, 
                    data: [], 
                    tension: 0.4, 
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 3,
                    hidden: false 
                },
                { 
                    label: 'Humedad', 
                    borderColor: '#3b82f6', 
                    backgroundColor: gradientHum, 
                    data: [], 
                    tension: 0.4, 
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 3,
                    hidden: true 
                },
                { 
                    label: 'Suelo', 
                    borderColor: '#10b981', 
                    backgroundColor: gradientSoil, 
                    data: [], 
                    tension: 0.4, 
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 3,
                    hidden: true 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    boxPadding: 4
                }
            },
            scales: { 
                y: { 
                    grid: { 
                        display: true,
                        color: '#f3f4f6',
                        drawBorder: false
                    }, 
                    beginAtZero: true,
                    ticks: { padding: 10, font: { size: 11 } }
                },
                x: { 
                    grid: { display: false },
                    ticks: { padding: 10, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 20 }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            layout: { padding: { top: 10, right: 10, bottom: 5, left: 5 } },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
    
    // Tank Sparkline Chart
    const tankCtx = document.getElementById('tankSparkline').getContext('2d');
    const tankGradient = tankCtx.createLinearGradient(0, 0, 0, 160);
    tankGradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
    tankGradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    tankSparklineChart = new Chart(tankCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#2563eb',
                backgroundColor: tankGradient,
                borderWidth: 2,
                tension: 0.5,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHitRadius: 20,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 13, weight: '600' },
                    callbacks: {
                        title: (context) => context[0].label || 'Nivel',
                        label: (context) => `${context.parsed.y}%`
                    }
                }
            },
            scales: {
                y: {
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        display: true,
                        color: '#f3f4f6',
                        drawBorder: false,
                        tickLength: 0
                    },
                    ticks: {
                        display: true,
                        font: { size: 10, weight: '500' },
                        color: '#9ca3af',
                        padding: 8,
                        maxTicksLimit: 3,
                        callback: (value) => value + '%'
                    }
                },
                x: { display: false }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
}

function showChart(type) {
    document.querySelectorAll('.interactive-card').forEach(el => {
        el.classList.remove('active-metric', 'active-temp', 'active-humidity', 'active-soil');
    });
    
    if (typeof chart === 'undefined') return;
    
    chart.data.datasets.forEach(ds => ds.hidden = true);
    chart.update('none');
    
    let title = "";
    let color = "";
    
    if (type === 'temp') {
        chart.data.datasets[0].hidden = false;
        title = "Gráfico: Temperatura";
        document.getElementById('card-temp').classList.add('active-metric', 'active-temp');
        color = "#f59e0b";
    } else if (type === 'humidity') {
        chart.data.datasets[1].hidden = false;
        title = "Gráfico: Humedad";
        document.getElementById('card-humidity').classList.add('active-metric', 'active-humidity');
        color = "#3b82f6";
    } else if (type === 'soil') {
        chart.data.datasets[2].hidden = false;
        title = "Gráfico: Suelo";
        document.getElementById('card-soil').classList.add('active-metric', 'active-soil');
        color = "#10b981";
    }
    
    document.getElementById('chart-title').innerText = title;
    document.getElementById('chart-title').style.color = color;
    
    chart.options.animation.y = { from: 0 };
    chart.update();
}

// Helper for color interpolation
function interpolateColor(value, min, max, startColor, endColor) {
    value = Math.max(min, Math.min(max, value));
    const ratio = (value - min) / (max - min);
    
    const parseHex = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    };
    
    const [r1, g1, b1] = parseHex(startColor);
    const [r2, g2, b2] = parseHex(endColor);
    
    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    
    return `rgb(${r}, ${g}, ${b})`;
}

// Data Fetching
function fetchSensorData() {
    fetch('/data')
        .then(response => response.json())
        .then(data => {
            // Update interval from backend config
            if (data.config && data.config.serverPollingInterval) {
                sensorDataInterval = data.config.serverPollingInterval * 1000;
            }
            
            updateUI(data);
            sensorDataTimeout = setTimeout(fetchSensorData, sensorDataInterval);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            sensorDataTimeout = setTimeout(fetchSensorData, sensorDataInterval);
        });
}

function updateUI(data) {
    lastData = data;
    
    // If charts aren't ready yet, wait for them
    if (typeof chart === 'undefined' || typeof tankSparklineChart === 'undefined') {
        console.log("Charts not ready, deferring UI update...");
        return;
    }
    const isStartup = data.lastMeasurementTime === 0;
    
    if (window.wasStartup && !isStartup) {
        console.log("✅ First measurement received, refreshing UI...");
        window.lastHistoryLength = null;
        window.lastHistoryTimestamp = null;
    }
    window.wasStartup = isStartup;

    // Update metrics
    const updateMetric = (id, value, unit = "") => {
        const el = document.getElementById(id);
        const unitEl = el.nextElementSibling;
        
        if (isStartup) {
             el.innerHTML = '<span class="status-initializing">Iniciando...</span>';
             if (unitEl && unitEl.classList.contains('metric-unit')) {
                unitEl.style.display = 'none';
             }
        } else if (value === -999 || value === -999.0) {
            el.innerHTML = '<span class="error-word">ERROR</span>';
            if (unitEl && unitEl.classList.contains('metric-unit')) {
                unitEl.style.display = 'none';
            }
        } else {
            el.innerText = value.toFixed(id === 'temp' ? 1 : 0);
            
            // Dynamic Colors
            if (id === 'temp') {
                el.style.color = interpolateColor(value, 15, 35, "#3b82f6", "#ef4444");
            } else if (id === 'humidity') {
                el.style.color = interpolateColor(value, 30, 90, "#9ca3af", "#2563eb");
            } else if (id === 'soil') {
                el.style.color = interpolateColor(value, 0, 100, "#d97706", "#10b981");
            } else if (id === 'light') {
                el.style.color = interpolateColor(value, 0, 100, "#1e3a8a", "#facc15");
            } else {
                el.style.color = "";
            }
            
            if (unitEl && unitEl.classList.contains('metric-unit')) {
                unitEl.style.display = '';
            }
        }
    };
    
    updateMetric('temp', data.temp, '°C');
    updateMetric('humidity', data.humidity, '%');
    updateMetric('soil', data.soilMoisture, '%');
    updateMetric('light', data.light, '%');
    
    // Tank
    const tankEl = document.getElementById('tank');
    const tankUnitEl = tankEl.nextElementSibling;
    const tankWarn = document.getElementById('tank-warning');
    const tankVisualWrapper = document.querySelector('.tank-visual-wrapper');

    if (isStartup) {
        tankEl.innerHTML = '<span class="status-initializing">Iniciando...</span>';
        if (tankUnitEl) tankUnitEl.style.display = 'none';
        document.getElementById('water-level').style.height = '0%';
        tankWarn.innerText = "Iniciando sistema...";
        tankWarn.style.color = "var(--text-secondary)";
        tankVisualWrapper.style.borderColor = "";
    } else if (data.tankLevel === -999) {
        tankEl.innerHTML = '<span class="error-word">ERROR</span>';
        if (tankUnitEl && tankUnitEl.classList.contains('metric-unit')) {
            tankUnitEl.style.display = 'none';
        }
        document.getElementById('water-level').style.height = '0%';
        tankWarn.innerText = "⚠️ Error Sensor";
        tankVisualWrapper.style.borderColor = "#ef4444";
    } else {
        tankEl.innerText = data.tankLevel.toFixed(0);
        tankEl.style.color = "";
        if (tankUnitEl && tankUnitEl.classList.contains('metric-unit')) {
            tankUnitEl.style.display = '';
        }
        document.getElementById('water-level').style.height = data.tankLevel + '%';
        
        tankVisualWrapper.style.borderColor = "";

        if (data.tankPump) {
            tankVisualWrapper.style.borderColor = "#10b981";
            tankWarn.innerText = "Llenando...";
            tankWarn.style.color = "#10b981";
        } else if (data.tankLevel >= 95) {
            tankWarn.innerText = "Lleno";
            tankWarn.style.color = "#6b7280";
        } else if (data.tankLevel < 20) {
            tankVisualWrapper.style.borderColor = "#ef4444";
            tankWarn.innerText = "⚠️ Nivel Crítico";
            tankWarn.style.color = "#ef4444";
        } else {
            tankWarn.innerText = "";
        }
    }
    
    // System Status
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    if (data.status === 0) {
        statusDot.style.backgroundColor = "#166534";
        statusText.innerText = "Conectado";
    } else if (data.status === 1) {
        statusDot.style.backgroundColor = "#ca8a04";
        statusText.innerText = "Alerta";
    } else if (data.status === 3) {
        statusDot.style.backgroundColor = "#ef4444";
        statusText.innerText = "Error Sensor";
    } else {
        statusDot.style.backgroundColor = "#ef4444";
        statusText.innerText = "Alarma";
    }
    
    // Chart Update from History
    if (data.history && Array.isArray(data.history)) {
        const historyChanged = !window.lastHistoryLength || 
                               window.lastHistoryLength !== data.history.length ||
                               (data.history.length > 0 && 
                                (!window.lastHistoryTimestamp || 
                                 window.lastHistoryTimestamp !== data.history[data.history.length - 1].timestamp));
        
        if (historyChanged) {
            window.lastHistoryLength = data.history.length;
            if (data.history.length > 0) {
                window.lastHistoryTimestamp = data.history[data.history.length - 1].timestamp;
            }
            
            // Only update charts if they are initialized
            if (typeof chart !== 'undefined' && typeof tankSparklineChart !== 'undefined') {
                updateChartWithHistory(data.history);
                updateTankSparkline(data.history);
            }
        }
    }
}

function updateChartWithHistory(history) {
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.data.datasets[2].data = [];
    
    const now = Date.now();
    const systemNow = lastData ? lastData.lastMeasurementTime : 0;
    const isEpoch = systemNow > 10000000000;
    
    history.forEach((record) => {
        let label = "";
        if (record.timestamp !== undefined) {
            if (isEpoch) {
                const date = new Date(record.timestamp);
                label = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            } else {
                const minutesAgo = Math.round((systemNow - record.timestamp) / 60000);
                label = minutesAgo === 0 ? "Ahora" : `-${minutesAgo}m`;
            }
        } else {
            label = "?";
        }
        
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(record.temp !== undefined ? record.temp : null);
        chart.data.datasets[1].data.push(record.humidity !== undefined ? record.humidity : null);
        chart.data.datasets[2].data.push(record.soilMoisture !== undefined ? record.soilMoisture : null);
    });
    
    delete chart.options.animation.y;
    chart.update(); // Animación estándar suave para nuevos puntos
}

function updateTankSparkline(history) {
    console.log("Actualizando Sparkline Tanque con", history.length, "puntos");
    tankSparklineChart.data.labels = [];
    tankSparklineChart.data.datasets[0].data = [];
    
    const systemNow = lastData ? lastData.lastMeasurementTime : 0;
    const isEpoch = systemNow > 10000000000;
    
    history.forEach((record) => {
        let label = "";
        if (record.timestamp !== undefined) {
            if (isEpoch) {
                const date = new Date(record.timestamp);
                label = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            } else {
                const minutesAgo = Math.round((systemNow - record.timestamp) / 60000);
                label = minutesAgo === 0 ? "Ahora" : `-${minutesAgo}m`;
            }
        } else {
            label = "?";
        }
        
        tankSparklineChart.data.labels.push(label);
        
        // Robust check for tank level (backend sends 'tank', demo might send 'tankLevel')
        let val = null;
        if (record.tank !== undefined) val = record.tank;
        else if (record.tankLevel !== undefined) val = record.tankLevel;
        
        tankSparklineChart.data.datasets[0].data.push(val);
    });
    
    delete tankSparklineChart.options.animation.y;
    tankSparklineChart.update(); // Animación estándar suave para nuevos puntos
}

// Demo Mode
function setDemoMode() {
    console.log("Demo mode activated");
    
    const demoData = {
        temp: 24.5,
        humidity: 65,
        soilMoisture: 45,
        light: 78,
        tankLevel: 75,
        tankPump: false,
        status: 0,
        lastMeasurementTime: Date.now(),
        history: []
    };
    
    // Generate demo history
    for (let i = 23; i >= 0; i--) {
        demoData.history.push({
            timestamp: Date.now() - (i * 10 * 60 * 1000),
            temp: 22 + Math.random() * 5,
            humidity: 60 + Math.random() * 15,
            soilMoisture: 40 + Math.random() * 20,
            tank: 70 + Math.random() * 15
        });
    }
    
    updateUI(demoData);
    
    // Update demo data periodically
    setInterval(() => {
        demoData.temp = 22 + Math.random() * 5;
        demoData.humidity = 60 + Math.random() * 15;
        demoData.soilMoisture = 40 + Math.random() * 20;
        demoData.light = 70 + Math.random() * 20;
        demoData.tankLevel = Math.max(20, Math.min(95, demoData.tankLevel + (Math.random() - 0.5) * 5));
        // Round tank level for display consistency in demo data
        demoData.tankLevel = Math.round(demoData.tankLevel);
        
        demoData.history.shift();
        demoData.history.push({
            timestamp: Date.now(),
            temp: demoData.temp,
            humidity: demoData.humidity,
            soilMoisture: demoData.soilMoisture,
            tank: demoData.tankLevel
        });
        
        updateUI(demoData);
    }, 5000);
}
