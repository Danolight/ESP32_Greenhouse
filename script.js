// Configuración
let chart;
let lastData = null; // Store last received data
const maxDataPoints = 24; // 4 hours at 10 min intervals
// Polling Control
let sensorDataTimeout = null;
let statusDataTimeout = null;
let sensorDataInterval = 5000;  // Default 5s, updated from backend config
let statusIdleInterval = 30000;     // Default 30s, updated from backend config

// Track pending toggle changes - UI won't update until backend confirms
let pendingToggles = {
    irrigationAuto: null,
    tankAuto: null,
    securityAuto: null,
    luminaryAuto: null,
    securitySchedule: false // New flag for schedule updates
};

window.onload = function() {
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        // Redirect to login if not authenticated
        window.location.href = '/';
        return;
    }
    
    // Prevent back button from going to login
    history.replaceState(null, null, window.location.href);
    window.addEventListener('popstate', function(event) {
        history.pushState(null, null, window.location.href);
        // Check authentication again when back button is pressed
        const isAuth = localStorage.getItem('isAuthenticated');
        if (!isAuth || isAuth !== 'true') {
            window.location.href = '/';
        }
    });
    
    // Initialize theme from localStorage
    initTheme();
    
    // Start fetching data IMMEDIATELY
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setDemoMode();
    } else {
        fetchSensorData(); // Initial full data fetch
        fetchStatusData();  // Start status polling (only active during security schedule)
    }
    
    // Initialize charts asynchronously
    waitForChart();
};

function waitForChart() {
    if (typeof Chart !== 'undefined') {
        initChart();
        // If data has already arrived, update the chart immediately
        if (lastData) {
            console.log("Chart loaded, populating with cached data...");
            updateUI(lastData);
        }
    } else {
        console.log('Esperando a Chart.js...');
        setTimeout(waitForChart, 100);
    }
}

// Logout function
// Page transition function
function navigateWithTransition(url) {
    document.body.classList.add('page-exiting');
    setTimeout(function() {
        window.location.href = url;
    }, 200);
}

function logout() {
    // Clear authentication data
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    localStorage.removeItem('isGuest');
    
    // Redirect to login with transition
    navigateWithTransition('login.html');
}
// Theme Management
function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('theme');
    
    // Apply saved theme on load
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        updateThemeIcon(true, false);
    }
    
    // Toggle theme on click
    themeToggleBtn.addEventListener('click', function() {
        const willBeDark = !document.body.classList.contains('dark-theme');
        triggerThemeTransition(willBeDark);
    });
}

function triggerThemeTransition(toDark) {
    const overlay = document.getElementById('theme-transition-overlay');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    
    // Don't set overlay background - let CSS handle it
    
    // Create second icon for smooth transition
    const currentIcon = themeToggleBtn.querySelector('.theme-icon');
    const newIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    newIcon.setAttribute('class', 'theme-icon theme-icon-new');
    newIcon.setAttribute('viewBox', '0 0 24 24');
    newIcon.setAttribute('fill', 'none');
    newIcon.setAttribute('stroke', 'currentColor');
    newIcon.setAttribute('stroke-width', '2');
    
    // Set content for new icon
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
    
    // Add new icon to button
    themeToggleBtn.appendChild(newIcon);
    
    // Start overlay animation
    overlay.classList.add('active');
    
    // Apply theme immediately (don't delay)
    if (toDark) {
        document.body.classList.add('dark-theme');
        document.documentElement.classList.add('dark-theme');
        // Apply dark theme inline styles
        document.documentElement.setAttribute('style', 'background-color: #0a0f1e !important;');
        document.body.setAttribute('style', 'background-color: #0a0f1e !important; color: #ffffff !important;');
    } else {
        document.body.classList.remove('dark-theme');
        document.documentElement.classList.remove('dark-theme');
        // Remove inline styles to let CSS take over for light mode
        document.documentElement.removeAttribute('style');
        document.body.removeAttribute('style');
    }
    
    // Save theme preference
    localStorage.setItem('theme', toDark ? 'dark' : 'light');
    
    // Change chart animation at midpoint (200ms for 0.4s animation)
    setTimeout(() => {
        // Disable chart animation during theme transition
        const originalAnimationDuration = chart.options.animation.y.duration;
        chart.options.animation.y.duration = 0;
        
        // Force chart redraw without animation
        chart.update('none');
        
        // Restore animation after a brief delay
        setTimeout(() => {
            chart.options.animation.y.duration = originalAnimationDuration;
        }, 100);
    }, 200);
    
    // Clean up after animation completes (0.4s)
    setTimeout(() => {
        overlay.classList.remove('active');
        
        // Remove old icon and clean up new icon
        currentIcon.remove();
        newIcon.classList.remove('moon-rising', 'sun-rising', 'sun-setting', 'moon-setting');
        newIcon.classList.remove('theme-icon-new');
    }, 400);
}

function updateThemeIcon(isDark, animate = false) {
    const themeIcon = document.querySelector('.theme-icon');
    
    if (animate) {
        // This function is now handled by triggerThemeTransition
        return;
    }
    
    // No animation, just set the icon (for page load)
    if (isDark) {
        themeIcon.innerHTML = `
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
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
// Check if we should poll status (only during security schedule)
function shouldPollStatus() {
    // Poll if Luminary Auto is enabled (to detect light changes)
    if (lastData && lastData.luminaryAuto) {
        return true;
    }

    if (!lastData || !lastData.securityAuto) {
        return false; // Security auto is disabled
    }
    
    // Get schedule times from the UI inputs
    const startTime = document.getElementById('time-start').value;
    const endTime = document.getElementById('time-end').value;
    
    if (!startTime || !endTime) {
        return false; // No schedule configured
    }
    
    // Parse times
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    // Get current time
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // Check if we're inside the window
    let insideWindow = false;
    if (startMinutes < endMinutes) {
        // Normal day schedule (e.g., 08:00 to 20:00)
        insideWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
        // Overnight schedule (e.g., 22:00 to 06:00)
        insideWindow = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    
    return insideWindow;
}

function getStatusInterval() {
    // Simple 30-second interval when needed
    return STATUS_IDLE_INTERVAL; // 30 seconds
}
function initChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#9ca3af';
    
    // Gradients - Fill to X axis with gradient
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
                duration: 2000, // Duración estándar para actualizaciones suaves
                easing: 'easeOutQuart'
            }
        }
    });
    
    // Tank Sparkline Chart
    const tankCtx = document.getElementById('tankSparkline').getContext('2d');
    const tankGradient = tankCtx.createLinearGradient(0, 0, 0, 160);
    // Vibrant Blue Gradient
    tankGradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');   // Blue-500
    tankGradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');   // Transparent

    window.tankSparklineChart = new Chart(tankCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#2563eb', // Blue-600 (Darker border)
                backgroundColor: tankGradient,
                borderWidth: 2,
                tension: 0.5, // Smoother curve
                fill: true,
                pointRadius: 4, // Visible points
                pointHoverRadius: 6, // Large hover radius
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHitRadius: 20, // Easier to hover
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
                        tickLength: 0 // No tick marks sticking out
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
    // Reset active classes
    document.querySelectorAll('.interactive-card').forEach(el => {
        el.classList.remove('active-metric', 'active-temp', 'active-humidity', 'active-soil');
    });
    
    if (typeof chart === 'undefined') return;
    
    // Hide all datasets WITHOUT animation first
    chart.data.datasets.forEach(ds => ds.hidden = true);
    chart.update('none'); // Update instantly without animation
    
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
    
    // Now animate the selected dataset appearing from bottom
    chart.options.animation.y = { from: 0 };
    chart.update();
    chart.options.animation.y = { from: 0 };
    chart.update();
}

// Helper for color interpolation
function interpolateColor(value, min, max, startColor, endColor) {
    // Clamp value
    value = Math.max(min, Math.min(max, value));
    const ratio = (value - min) / (max - min);
    
    // Parse hex
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

function updateUI(data) {
    lastData = data; // Update global data
    
    // If charts aren't ready yet, wait for them
    if (typeof chart === 'undefined' || typeof window.tankSparklineChart === 'undefined') {
        console.log("Charts not ready, deferring UI update...");
        return;
    }
    
    // Check for startup state (no measurements yet)
    const isStartup = data.lastMeasurementTime === 0;
    
    // Detect transition from startup to normal (first measurement arrived)
    if (window.wasStartup && !isStartup) {
        console.log("✅ First measurement received, refreshing UI...");
        // Force a full UI update by clearing any cached state
        window.lastHistoryLength = null;
        window.lastHistoryTimestamp = null;
    }
    window.wasStartup = isStartup;

    // Metrics
    const updateMetric = (id, value, unit = "") => {
        const el = document.getElementById(id);
        const unitEl = el.nextElementSibling; // Get the unit span element
        
        if (isStartup) {
             el.innerHTML = '<span class="status-initializing">Iniciando...</span>';
             if (unitEl && unitEl.classList.contains('metric-unit')) {
                unitEl.style.display = 'none';
             }
        } else if (value === -999 || value === -999.0) {
            el.innerHTML = '<span class="error-word">ERROR</span>';
            // Hide the unit when there's an error
            if (unitEl && unitEl.classList.contains('metric-unit')) {
                unitEl.style.display = 'none';
            }
        } else {
            el.innerText = value.toFixed(id === 'temp' ? 1 : 0);
            
            // Dynamic Colors
            if (id === 'temp') {
                // Blue (Cold) -> Orange/Red (Hot)
                // Range: 15°C (#3b82f6) -> 35°C (#ef4444)
                el.style.color = interpolateColor(value, 15, 35, "#3b82f6", "#ef4444");
            } else if (id === 'humidity') {
                // Gray/Blue (Dry) -> Deep Blue (Wet)
                // Range: 30% (#9ca3af) -> 90% (#2563eb)
                el.style.color = interpolateColor(value, 30, 90, "#9ca3af", "#2563eb");
            } else if (id === 'soil') {
                // Brown/Orange (Dry) -> Green (Wet)
                // Range: 0% (#d97706) -> 100% (#10b981)
                el.style.color = interpolateColor(value, 0, 100, "#d97706", "#10b981");
            } else if (id === 'light') {
                // Dark (Dark Blue) -> Bright (Yellow)
                // Range: 0% (#1e3a8a) -> 100% (#facc15)
                el.style.color = interpolateColor(value, 0, 100, "#1e3a8a", "#facc15");
            } else {
                el.style.color = ""; // Reset
            }
            
            // Show the unit for normal values
            if (unitEl && unitEl.classList.contains('metric-unit')) {
                unitEl.style.display = '';
                // Also color the unit to match? Maybe subtle.
                // unitEl.style.color = el.style.color; 
                // Let's keep unit neutral for readability or match? 
                // User asked for "numbers" to have color. Let's stick to numbers.
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
        tankVisualWrapper.style.borderColor = ""; // Neutral border
    } else if (data.tankLevel === -999) {
        tankEl.innerHTML = '<span class="error-word">ERROR</span>';
        // Hide the unit when there's an error
        if (tankUnitEl && tankUnitEl.classList.contains('metric-unit')) {
            tankUnitEl.style.display = 'none';
        }
        document.getElementById('water-level').style.height = '0%';
        tankWarn.innerText = "⚠️ Error Sensor";
        tankVisualWrapper.style.borderColor = "#ef4444"; // Red border on error
    } else {
        tankEl.innerText = data.tankLevel;
        tankEl.style.color = "";
        // Show the unit for normal values
        if (tankUnitEl && tankUnitEl.classList.contains('metric-unit')) {
            tankUnitEl.style.display = '';
        }
        document.getElementById('water-level').style.height = data.tankLevel + '%';
        
        // Reset visual wrapper border
        tankVisualWrapper.style.borderColor = "";

        if (data.tankPump) {
            // Filling: Green border, "Llenando"
            tankVisualWrapper.style.borderColor = "#10b981"; // Green
            tankWarn.innerText = "Llenando...";
            tankWarn.style.color = "#10b981";
        } else if (data.tankLevel >= 95) {
            // Full: Gray border (default), "Lleno"
            tankWarn.innerText = "Lleno";
            tankWarn.style.color = "#6b7280"; // Gray
        } else if (data.tankLevel < 20) {
            // Low: Red border, "Nivel Crítico"
            tankVisualWrapper.style.borderColor = "#ef4444"; // Red
            tankWarn.innerText = "⚠️ Nivel Crítico";
            tankWarn.style.color = "#ef4444";
        } else {
            // Normal
            tankWarn.innerText = "";
        }
    }
    // --- Controls ---
    
    // 1. Irrigation
    const chkIrrigation = document.getElementById('chk-irrigation-auto');
    // Always update toggles, even during startup, to show correct default state
    if (document.activeElement !== chkIrrigation && pendingToggles.irrigationAuto === null) {
        chkIrrigation.checked = data.irrigationAuto || false;
    } 
    
    const btnIrrigation = document.getElementById('btn-irrigation');
    const statusIrrigation = document.getElementById('status-irrigation');
    
    // Logic: If tank is low OR error, disable irrigation button
    if (isStartup) {
        btnIrrigation.disabled = true;
        btnIrrigation.style.opacity = '0.5';
        btnIrrigation.innerText = "ESPERANDO...";
        btnIrrigation.classList.remove('btn-on', 'btn-off');
        statusIrrigation.className = 'status-indicator';
    } else if (data.tankLevel < 20 || data.tankLevel === -999) {
        btnIrrigation.disabled = true;
        btnIrrigation.style.opacity = '0.5';
        btnIrrigation.innerText = data.tankLevel === -999 ? "ERROR" : "BAJO";
        btnIrrigation.classList.remove('btn-on', 'btn-off');
        statusIrrigation.className = 'status-indicator error';
    } else {
        btnIrrigation.disabled = false;
        btnIrrigation.style.opacity = '1';
        updateButton('btn-irrigation', data.pump);
        statusIrrigation.className = data.pump ? 'status-indicator active' : 'status-indicator';
    }
    // 2. Tank
    const btnTank = document.getElementById('btn-tank');
    const statusTank = document.getElementById('status-tank');
    updateButton('btn-tank', data.tankPump);
    statusTank.className = data.tankPump ? 'status-indicator active' : 'status-indicator';
    
    const chkTank = document.getElementById('chk-tank-auto');
    if (document.activeElement !== chkTank && pendingToggles.tankAuto === null) {
        chkTank.checked = data.tankAuto || false;
    }
    
    // 3. Security
    const statusSecurity = document.getElementById('status-security');
    updateButton('btn-security', data.security);
    
    // Determine security status class
    if (data.status === 2) { // Alarm
        statusSecurity.className = 'status-indicator alarm';
    } else {
        statusSecurity.className = data.security ? 'status-indicator active' : 'status-indicator';
    }
    
    const chkSecAuto = document.getElementById('chk-security-auto');
    if (document.activeElement !== chkSecAuto && document.activeElement.type !== 'time' && pendingToggles.securityAuto === null) {
        if (chkSecAuto.checked !== (data.securityAuto || false)) {
            chkSecAuto.checked = data.securityAuto || false;
            // Update schedule visibility
            const scheduleDiv = document.getElementById('security-schedule');
            if (data.securityAuto) {
                scheduleDiv.classList.add('show');
            } else {
                scheduleDiv.classList.remove('show');
            }
        }
    }
    
    // Update schedule inputs if data is available (and not currently being edited)
    // AND not pending update (prevents resetting while waiting for backend)
    if (!pendingToggles.securitySchedule) {
        if (data.securityStart && document.activeElement.id !== 'time-start') {
            document.getElementById('time-start').value = data.securityStart;
        }
        if (data.securityEnd && document.activeElement.id !== 'time-end') {
            document.getElementById('time-end').value = data.securityEnd;
        }
    }

    // 4. Luminary
    const statusLuminary = document.getElementById('status-luminary');
    updateButton('btn-luminary', data.luminary);
    statusLuminary.className = data.luminary ? 'status-indicator active' : 'status-indicator';

    const chkLumAuto = document.getElementById('chk-luminary-auto');
    if (document.activeElement !== chkLumAuto && pendingToggles.luminaryAuto === null) {
        chkLumAuto.checked = data.luminaryAuto || false;
    }
    // System Status & Power Calculation
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    // Update status indicator
    if (data.status === 0) {
        statusDot.style.backgroundColor = "#166534"; // Green
        statusText.innerText = "Conectado";
    } else if (data.status === 1) {
        statusDot.style.backgroundColor = "#ca8a04"; // Yellow
        statusText.innerText = "Alerta";
    } else if (data.status === 3) { // Sensor Error
        statusDot.style.backgroundColor = "#ef4444"; // Red
        statusText.innerText = "Error Sensor";
    } else {
        statusDot.style.backgroundColor = "#ef4444"; // Red
        statusText.innerText = "Alarma";
    }
    // Power Calculation - Commented out (diagnostics card removed)
    // let power = 25; // Base
    // let isHighConsumption = false;
    // if (data.pump) { power += 10; isHighConsumption = true; }
    // if (data.tankPump) { power += 10; isHighConsumption = true; }
    // if (data.status > 0) { power += 15; isHighConsumption = true; }
    // document.getElementById('power-est').innerText = power;
    // if (isHighConsumption) {
    //     sysText.innerText = "MÁXIMO CONSUMO";
    //     sysText.style.color = "#ca8a04";
    // } else {
    //     sysText.innerText = "BAJO CONSUMO";
    //     sysText.style.color = "#166534";
    // }
    // Chart Update from History (OPTIMIZED: only update if history changed)
    if (data.history && Array.isArray(data.history)) {
        console.log("\n=== DATOS RECIBIDOS ===");
        console.log("Puntos en historial:", data.history.length);
        console.log("lastMeasurementTime:", data.lastMeasurementTime);
        
        // Check if history has changed
        const historyChanged = !window.lastHistoryLength || 
                               window.lastHistoryLength !== data.history.length ||
                               (data.history.length > 0 && 
                                (!window.lastHistoryTimestamp || 
                                 window.lastHistoryTimestamp !== data.history[data.history.length - 1].timestamp));
        
        if (historyChanged) {
            console.log("*** HISTORIA CAMBIO - Actualizando grafica ***");
            if (data.history.length > 0) {
                console.log("Primer punto:", data.history[0]);
                console.log("Ultimo punto:", data.history[data.history.length - 1]);
            }
            
            // Update tracking variables
            window.lastHistoryLength = data.history.length;
            if (data.history.length > 0) {
                window.lastHistoryTimestamp = data.history[data.history.length - 1].timestamp;
            }
            
            updateChartWithHistory(data.history);
            updateTankSparkline(data.history);
        } else {
            console.log("Historia sin cambios - Omitiendo actualizacion de grafica");
        }
    } else {
        console.warn("No se recibio historial o formato incorrecto");
    }
}
function updateChartWithHistory(history) {
    console.log("\n=== ACTUALIZANDO GRAFICA ===");
    console.log("Procesando", history.length, "puntos");
    
    if (typeof chart === 'undefined') return;
    
    // Clear current data
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.data.datasets[2].data = [];
    const now = Date.now();
    // Use lastData.lastMeasurementTime if available, else assume 0
    const systemNow = lastData ? lastData.lastMeasurementTime : 0;
    
    // Heuristic: If systemNow is huge (> 1e10), it's Epoch (Demo Mode or RTC).
    // If small, it's millis() (ESP32 uptime).
    const isEpoch = systemNow > 10000000000;
    history.forEach((record) => {
        let label = "";
        if (record.timestamp !== undefined) {
            if (isEpoch) {
                // Demo Mode: Timestamp is already a valid Date
                label = new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (systemNow >= 0) {
                // Real Mode: Timestamp is millis(). Calculate age relative to client now.
                const age = systemNow - record.timestamp;
                // If age is negative (shouldn't happen), treat as 0
                const pointTime = new Date(now - (age < 0 ? 0 : age));
                label = pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        } else {
            // Fallback if no timestamp
            label = "T-" + (history.length - chart.data.labels.length);
        }
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(record.temp === -999 ? 0 : record.temp);
        chart.data.datasets[1].data.push(record.humidity === -999 ? 0 : record.humidity);
        chart.data.datasets[2].data.push(record.soil === -999 ? 0 : record.soil);
    });
    
    
    delete chart.options.animation.y;
    chart.update(); // Animación estándar suave, igual que el tanque
    console.log("Grafica actualizada con", chart.data.labels.length, "puntos");
    console.log("Labels:", chart.data.labels);
}
function updateButton(btnId, isActive) {
    const btn = document.getElementById(btnId);
    // Security Auto check handled in updateUI
    // if (btnId === 'btn-security' && document.getElementById('chk-security-auto').checked) return; // Removed to allow status update
    btn.classList.remove('btn-on', 'btn-off');
    if (isActive) {
        btn.classList.add('btn-on');
        btn.innerText = "ON";
    } else {
        btn.classList.add('btn-off');
        btn.innerText = "OFF";
    }
}

function updateTankSparkline(history) {
    if (typeof window.tankSparklineChart === 'undefined' || !history || history.length === 0) return;
    
    // Extract tank data and generate time labels
    const tankData = history.map(record => (record.tank === -999 ? 0 : (record.tank || 0)));
    const now = Date.now();
    const systemNow = lastData ? lastData.lastMeasurementTime : 0;
    
    const labels = history.map(record => {
        if (!record.timestamp) return '';
        
        // Check if timestamp is in epoch format (>1e10) or millis since boot
        if (record.timestamp > 1e10) {
            // Demo Mode or RTC: timestamp is epoch
            const pointTime = new Date(record.timestamp);
            return pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            // Real Mode: timestamp is millis since boot
            const age = systemNow - record.timestamp;
            const pointTime = new Date(now - (age < 0 ? 0 : age));
            return pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    });
    
    // Update chart with animation
    window.tankSparklineChart.data.labels = labels;
    window.tankSparklineChart.data.datasets[0].data = tankData;
    window.tankSparklineChart.update(); // Enable animation
    
    // Calculate last filled time
    let lastFilledIndex = -1;
    for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1].tank || 0;
        const curr = history[i].tank || 0;
        // Detect significant increase (>10%) indicating a fill
        if (curr - prev > 10) {
            lastFilledIndex = i;
        }
    }
    
    const lastFilledEl = document.getElementById('tank-last-filled');
    if (lastFilledIndex >= 0 && history[lastFilledIndex].timestamp) {
        const fillTime = history[lastFilledIndex].timestamp;
        const now = lastData ? lastData.lastMeasurementTime : Date.now();
        const hoursAgo = Math.floor((now - fillTime) / (1000 * 60 * 60));
        const minutesAgo = Math.floor((now - fillTime) / (1000 * 60));
        
        if (hoursAgo > 0) {
            lastFilledEl.innerText = `Último llenado: hace ${hoursAgo}h`;
        } else if (minutesAgo > 0) {
            lastFilledEl.innerText = `Último llenado: hace ${minutesAgo}min`;
        } else {
            lastFilledEl.innerText = 'Último llenado: reciente';
        }
    } else {
        lastFilledEl.innerText = 'Último llenado: --';
    }
}

// Fetch full sensor data + history
function fetchSensorData() {
    if (sensorDataTimeout) clearTimeout(sensorDataTimeout);
    fetch('/data')
        .then(res => res.json())
        .then(data => {
            console.log("📊 Sensor data received:", data.history ? data.history.length + " history points" : "no history");
            
            // Update intervals from backend config
            if (data.config) {
                if (data.config.serverPollingInterval) {
                    sensorDataInterval = data.config.serverPollingInterval * 1000;
                }
                if (data.config.statusPollingInterval) {
                    statusIdleInterval = data.config.statusPollingInterval * 1000;
                }
            }
            
            updateUI(data);
            sensorDataTimeout = setTimeout(fetchSensorData, sensorDataInterval);
        })
        .catch(e => {
            console.error("Sensor fetch error:", e);
            document.getElementById('status-text').innerText = "Desconectado";
            document.getElementById('status-dot').style.backgroundColor = "#9ca3af";
            sensorDataTimeout = setTimeout(fetchSensorData, sensorDataInterval);
        });
}
// Fetch lightweight status (only during security schedule)
function fetchStatusData() {
    if (statusDataTimeout) clearTimeout(statusDataTimeout);
    
    // Only fetch if we should be polling
    if (!shouldPollStatus()) {
        console.log('⏸️ Status polling paused (outside security schedule or auto disabled)');
        // Check again in 60 seconds to see if we should resume
        statusDataTimeout = setTimeout(fetchStatusData, 60000);
        return;
    }
    
    fetch('/status')
        .then(res => res.json())
        .then(data => {
            // Merge status into lastData to preserve sensor readings
            if (lastData) {
                lastData.pump = data.pump;
                lastData.tankPump = data.tankPump;
                lastData.status = data.status;
                lastData.security = data.security;
                lastData.luminary = data.luminary;
                lastData.irrigationAuto = data.irrigationAuto;
                lastData.tankAuto = data.tankAuto;
                lastData.securityAuto = data.securityAuto;
                lastData.luminaryAuto = data.luminaryAuto;
                
                // Clear pending toggles if confirmed by backend
                if (pendingToggles.irrigationAuto === data.irrigationAuto) pendingToggles.irrigationAuto = null;
                if (pendingToggles.tankAuto === data.tankAuto) pendingToggles.tankAuto = null;
                if (pendingToggles.securityAuto === data.securityAuto) pendingToggles.securityAuto = null;
                if (pendingToggles.luminaryAuto === data.luminaryAuto) pendingToggles.luminaryAuto = null;
                
                updateUI(lastData);
            }
            
            // Schedule next status poll
            statusDataTimeout = setTimeout(fetchStatusData, statusIdleInterval);
            console.log('🔐 Security monitoring active - next poll in ' + (statusIdleInterval/1000) + 's');
        })
        .catch(e => {
            console.error("Status fetch error:", e);
            // Retry with same interval
            statusDataTimeout = setTimeout(fetchStatusData, statusIdleInterval);
        });
}
// --- Actions ---
function toggleIrrigationAuto() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
    const isChecked = document.getElementById('chk-irrigation-auto').checked;
    pendingToggles.irrigationAuto = isChecked;
    sendAction({ irrigationAuto: isChecked });
    console.log("Toggle Auto Irrigation: " + isChecked);
}
function toggleIrrigationManual() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
    
    // Check tank level before allowing manual on
    if (lastData && lastData.tankLevel < 20) {
        alert("Nivel de tanque bajo (<20%). No se puede regar.");
        return;
    }
    
    const current = lastData ? lastData.pump : false;
    const durationInput = document.getElementById('irrigation-duration');
    const duration = durationInput ? parseInt(durationInput.value) : 0;
    
    // 🚀 OPTIMISTIC UI: Update button immediately
    updateButton('btn-irrigation', !current);
    const statusIrrigation = document.getElementById('status-irrigation');
    statusIrrigation.className = !current ? 'status-indicator active' : 'status-indicator';
    
    // Toggle: If ON -> Turn OFF (force=false). If OFF -> Turn ON (force=true)
    // Send duration only if turning ON
    const payload = { 
        forceIrrigation: !current,
        duration: !current ? duration : 0
    };
    
    sendAction(payload);
}
function toggleTankAuto() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
    const isChecked = document.getElementById('chk-tank-auto').checked;
    pendingToggles.tankAuto = isChecked;
    sendAction({ tankAuto: isChecked });
    console.log("Toggle Auto Tank: " + isChecked);
}
function toggleTankManual() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
    
    // Check for sensor error
    if (lastData && lastData.tankLevel === -999) {
        alert("Error en sensor de tanque. No se puede activar llenado manual.");
        return;
    }

    const current = lastData ? lastData.tankPump : false;
    
    // 🚀 OPTIMISTIC UI: Update button immediately
    updateButton('btn-tank', !current);
    const statusTank = document.getElementById('status-tank');
    statusTank.className = !current ? 'status-indicator active' : 'status-indicator';
    
    sendAction({ forceTank: !current });
}
function toggleSecurity() {
    // Automatically disable Auto if it's on
    const autoCheckbox = document.getElementById('chk-security-auto');
    if (autoCheckbox.checked) {
        autoCheckbox.checked = false;
        const scheduleDiv = document.getElementById('security-schedule');
        scheduleDiv.classList.remove('show');
        
        sendAction({ securityAuto: false });
    }
    
    const current = lastData ? lastData.security : false;
    
    // 🚀 OPTIMISTIC UI: Update button immediately
    updateButton('btn-security', !current);
    const statusSecurity = document.getElementById('status-security');
    // Don't override alarm state
    if (lastData && lastData.status !== 2) {
        statusSecurity.className = !current ? 'status-indicator active' : 'status-indicator';
    }
    
    sendAction({ security: !current });
}
function toggleSecurityAuto() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
    
    const isChecked = document.getElementById('chk-security-auto').checked;
    const scheduleDiv = document.getElementById('security-schedule');
    
    console.log("🔐 Security Auto toggled:", isChecked);
    console.log("📅 Schedule div found:", scheduleDiv);
    
    if (isChecked) {
        scheduleDiv.classList.add('show');
        // scheduleDiv.style.display = 'block'; // Removed to allow CSS transition
        console.log("✅ Added 'show' class, classes:", scheduleDiv.className);
    } else {
        scheduleDiv.classList.remove('show');
        // scheduleDiv.style.display = 'none'; // Removed to allow CSS transition
        console.log("❌ Removed 'show' class");
    }
    
    // Mark as pending until backend confirms
    pendingToggles.securityAuto = isChecked;
    
    // Send to backend
    sendAction({ securityAuto: isChecked });
    
    console.log("Toggle Auto Security: " + isChecked);
}

function saveSchedule() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log("Demo mode - Schedule saved");
        return;
    }

    const startTime = document.getElementById('time-start').value;
    const endTime = document.getElementById('time-end').value;

    if (!startTime || !endTime) {
        alert("Por favor configure ambas horas: Inicio y Fin.");
        return;
    }

    const payload = {
        securityStart: startTime,
        securityEnd: endTime
    };

    sendAction(payload);
    console.log("Schedule sent:", payload);
    
    // Prevent UI reset for 5 seconds to allow backend to process
    pendingToggles.securitySchedule = true;
    setTimeout(() => {
        pendingToggles.securitySchedule = false;
    }, 5000);
}

function toggleLuminaryAuto() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
    const isChecked = document.getElementById('chk-luminary-auto').checked;
    
    // Just toggle auto mode without affecting manual state
    pendingToggles.luminaryAuto = isChecked;
    sendAction({ luminaryAuto: isChecked });
    console.log("Toggle Auto Luminary: " + isChecked);
}

function toggleLuminaryManual() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
    
    // Disable Auto when Manual is used
    const autoCheckbox = document.getElementById('chk-luminary-auto');
    if (autoCheckbox.checked) {
        autoCheckbox.checked = false;
        sendAction({ luminaryAuto: false });
    }
    
    const current = lastData ? lastData.luminary : false;
    
    // 🚀 OPTIMISTIC UI: Update button immediately
    updateButton('btn-luminary', !current);
    const statusLuminary = document.getElementById('status-luminary');
    statusLuminary.className = !current ? 'status-indicator active' : 'status-indicator';
    
    sendAction({ forceLuminary: !current });
}

function acknowledgeAlarm() {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log("Demo mode - Alarm acknowledged");
        return;
    }
    
    // Send clear action
    sendAction({ clearAlarm: true });
    console.log("Alarm acknowledged - Sending clear command");
}
function setDemoMode() {
    // Demo mode for testing without ESP32
    console.log('Running in demo mode (file:// or localhost)');
    
    const now = Date.now();
    const tenMins = 10 * 60 * 1000;
    
    // Set initial demo data with history
    const demoData = {
        temp: 22.5,
        humidity: 62,
        soilMoisture: 48,
        light: 65,
        tankLevel: 75,
        pump: false,
        tankPump: false,
        security: false,
        luminary: false,
        irrigationAuto: true,
        tankAuto: true,
        securityAuto: true,
        luminaryAuto: true,
        status: 0,
        lastMeasurementTime: now,
        history: []
    };

    // Populate initial history (last 12 points for better visualization)
    let baseTemp = 20;
    let baseHumidity = 60;
    let baseSoil = 50;
    let baseTank = 85;
    
    for (let i = 11; i >= 0; i--) {
        // Natural variations: temperature rises during day, humidity inversely related
        const timeOfDay = ((now - (i * tenMins)) / (1000 * 60 * 60)) % 24;
        const tempVariation = Math.sin((timeOfDay - 6) * Math.PI / 12) * 4; // Peak at 2pm
        const humidityVariation = -tempVariation * 0.8; // Inverse relationship
        
        demoData.history.push({
            temp: parseFloat((baseTemp + tempVariation + (Math.random() - 0.5) * 1.5).toFixed(1)),
            humidity: Math.floor(baseHumidity + humidityVariation + (Math.random() - 0.5) * 5),
            soil: Math.floor(baseSoil + (Math.random() - 0.5) * 8),
            tank: Math.floor(baseTank + (Math.random() - 0.3) * 3), // Slight downward trend
            timestamp: now - (i * tenMins)
        });
        
        baseSoil -= 0.5; // Soil moisture gradually decreases
        baseTank -= 0.8; // Tank level gradually decreases
    }
    
    // Set current values from last history point
    const lastPoint = demoData.history[demoData.history.length - 1];
    demoData.temp = lastPoint.temp;
    demoData.humidity = lastPoint.humidity;
    demoData.soilMoisture = lastPoint.soil;
    demoData.tankLevel = lastPoint.tank;
    
    updateUI(demoData);
    
    // Update demo data periodically to simulate 10-minute intervals
    // We'll run this every 3 seconds to simulate "fast forward" time
    setInterval(() => {
        // Advance time by 10 minutes
        demoData.lastMeasurementTime += tenMins;
        
        // Realistic variations based on time of day
        const timeOfDay = (demoData.lastMeasurementTime / (1000 * 60 * 60)) % 24;
        const isDaytime = timeOfDay >= 6 && timeOfDay <= 18;
        
        // Temperature: warmer during day (20-28°C), cooler at night (18-22°C)
        const tempTrend = isDaytime ? 24 + Math.sin((timeOfDay - 6) * Math.PI / 12) * 4 : 20;
        demoData.temp = parseFloat((tempTrend + (Math.random() - 0.5) * 1.2).toFixed(1));
        
        // Humidity: inversely related to temperature (50-80%)
        const humidityTrend = isDaytime ? 55 : 70;
        demoData.humidity = Math.floor(humidityTrend + (Math.random() - 0.5) * 8);
        
        // Soil moisture: gradually decreases, increases when pump is on
        if (demoData.pump) {
            demoData.soilMoisture = Math.min(100, demoData.soilMoisture + 8);
        } else {
            demoData.soilMoisture = Math.max(20, demoData.soilMoisture - (Math.random() * 2));
        }
        demoData.soilMoisture = Math.floor(demoData.soilMoisture);
        
        // Light: realistic day/night cycle (0-100%)
        if (isDaytime) {
            const lightPeak = Math.sin((timeOfDay - 6) * Math.PI / 12);
            demoData.light = Math.floor(60 + lightPeak * 35 + (Math.random() - 0.5) * 10);
        } else {
            demoData.light = Math.floor(Math.random() * 15); // Low light at night
        }
        
        // Tank level: decreases when pump is on, increases when tank pump is on
        if (demoData.pump) demoData.tankLevel -= 3;
        if (demoData.tankPump) demoData.tankLevel += 8;
        if (!demoData.pump && !demoData.tankPump) demoData.tankLevel -= 0.3; // Slow natural decrease
        
        demoData.tankLevel = Math.max(0, Math.min(100, demoData.tankLevel));
        demoData.tankLevel = Math.floor(demoData.tankLevel);
        
        // Add to history
        demoData.history.push({
            temp: demoData.temp,
            humidity: demoData.humidity,
            soil: demoData.soilMoisture,
            tank: demoData.tankLevel,
            timestamp: demoData.lastMeasurementTime
        });
        
        // Keep history size limited
        if (demoData.history.length > 24) {
            demoData.history.shift();
        }
        updateUI(demoData);
    }, 3000); // 3 seconds real time = 10 minutes simulated time
}

// Send action to backend
function sendAction(payload) {
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log("Demo mode - Action not sent:", payload);
        return;
    }
    
    fetch('/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        console.log("✅ Action sent successfully:", payload);
        // Force immediate status update to sync UI
        fetch('/status')
            .then(res => res.json())
            .then(statusData => {
                // Merge status into lastData
                if (lastData) {
                    lastData.pump = statusData.pump;
                    lastData.tankPump = statusData.tankPump;
                    lastData.security = statusData.security;
                    lastData.luminary = statusData.luminary;
                    lastData.status = statusData.status;
                    updateUI(lastData);
                }
            })
            .catch(e => console.error("Status update error:", e));
    })
    .catch(e => {
        console.error("❌ Action error:", e);
    });
}


// Configuration button handler
function openConfig() {
    console.log('openConfig called, protocol:', window.location.protocol);
    console.log('Current location:', window.location.href);
    
    // Check if running on local dev server (localhost/127.0.0.1) or ESP32
    let targetUrl;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Local development server - config.html is in same folder
        targetUrl = 'config.html';
        console.log('Navigating to (local dev):', targetUrl);
    } else if (window.location.protocol === 'file:') {
        // File protocol - same folder
        targetUrl = 'config.html';
        console.log('Navigating to (file):', targetUrl);
    } else {
        // ESP32 server - root path
        targetUrl = '/config.html';
        console.log('Navigating to (ESP32):', targetUrl);
    }
    
    // Navigate with transition
    navigateWithTransition(targetUrl);
}
