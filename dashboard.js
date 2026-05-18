/**
 * ZenPexels GFX Analytics Dashboard Logic
 * Handles calculations, rendering Chart.js visualizations, list rankings,
 * date filtering, live events, simulations, exports, and theme toggling.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. Core State & Element Selectors
    // ----------------------------------------------------
    let currentRange = '30days'; // 'today', 'yesterday', '7days', '30days'
    let trendChartInstance = null;
    let sourceChartInstance = null;
    let autoSimulateInterval = null;

    // DOM Elements
    const kpiVisitors = document.getElementById('kpi-visitors');
    const kpiPageviews = document.getElementById('kpi-pageviews');
    const kpiDuration = document.getElementById('kpi-duration');
    const kpiBounce = document.getElementById('kpi-bounce');

    const trendVisitors = document.getElementById('trend-visitors');
    const trendPageviews = document.getElementById('trend-pageviews');
    const trendDuration = document.getElementById('trend-duration');
    const trendBounce = document.getElementById('trend-bounce');

    const countryList = document.getElementById('country-list');
    const deviceList = document.getElementById('device-list');
    const phoneList = document.getElementById('phone-list');
    const browserList = document.getElementById('browser-list-container');
    const pagesList = document.getElementById('pages-list');
    const streamContainer = document.getElementById('stream-log-container');
    const liveOnlineCount = document.getElementById('live-online-count');

    // Controls
    const btnSimulate = document.getElementById('btn-simulate');
    const btnExport = document.getElementById('btn-export');
    const btnReset = document.getElementById('btn-reset');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const filterButtons = document.querySelectorAll('.filter-group .filter-btn');

    // Toast
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');

    // ----------------------------------------------------
    // 2. Theme Toggling Integration
    // ----------------------------------------------------
    function getSystemTheme() {
        const savedTheme = localStorage.getItem('zen_analytics_theme');
        if (savedTheme) return savedTheme;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('zen_analytics_theme', theme);
        
        // Update toggle button icon
        const icon = themeToggleBtn.querySelector('i');
        if (theme === 'light') {
            icon.className = 'fa-solid fa-sun';
            themeToggleBtn.style.color = '#d97706';
        } else {
            icon.className = 'fa-solid fa-moon';
            themeToggleBtn.style.color = 'var(--text-primary)';
        }

        // Re-render charts to update gridline colors and font styling
        if (trendChartInstance && sourceChartInstance) {
            updateCharts();
        }
    }

    themeToggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        showToast(`<i class="fa-solid fa-circle-half-stroke"></i> Theme switched to ${next.toUpperCase()} mode`);
    });

    // Initialize Theme
    applyTheme(getSystemTheme());

    // ----------------------------------------------------
    // 3. Helper Functions
    // ----------------------------------------------------
    function showToast(message) {
        toastMsg.innerHTML = message;
        toast.classList.add('active');
        
        // Vibrate if mobile supported
        if (navigator.vibrate) navigator.vibrate(50);

        setTimeout(() => {
            toast.classList.remove('active');
        }, 3500);
    }

    function formatDuration(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0s';
        if (seconds < 60) return `${Math.floor(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    }

    function getRangeTimestamps(range) {
        const now = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        let rangeStart = 0;
        let rangeEnd = end.getTime();
        let precedingStart = 0;
        let precedingEnd = 0;

        const oneDayMs = 24 * 60 * 60 * 1000;

        switch (range) {
            case 'today':
                rangeStart = start.getTime();
                precedingStart = rangeStart - oneDayMs;
                precedingEnd = rangeStart - 1;
                break;
            case 'yesterday':
                rangeStart = start.getTime() - oneDayMs;
                rangeEnd = start.getTime() - 1;
                precedingStart = rangeStart - oneDayMs;
                precedingEnd = rangeStart - 1;
                break;
            case '7days':
                rangeStart = now.getTime() - (7 * oneDayMs);
                precedingStart = rangeStart - (7 * oneDayMs);
                precedingEnd = rangeStart - 1;
                break;
            case '30days':
            default:
                rangeStart = now.getTime() - (30 * oneDayMs);
                precedingStart = rangeStart - (30 * oneDayMs);
                precedingEnd = rangeStart - 1;
                break;
        }

        return { rangeStart, rangeEnd, precedingStart, precedingEnd };
    }

    // ----------------------------------------------------
    // 4. Data Processing Engine
    // ----------------------------------------------------
    function getFilteredData(range) {
        const db = window.ZenAnalytics.getDb();
        const { rangeStart, rangeEnd } = getRangeTimestamps(range);
        
        return db.filter(r => r.timestamp >= rangeStart && r.timestamp <= rangeEnd);
    }

    function getPrecedingData(range) {
        const db = window.ZenAnalytics.getDb();
        const { precedingStart, precedingEnd } = getRangeTimestamps(range);
        
        return db.filter(r => r.timestamp >= precedingStart && r.timestamp <= precedingEnd);
    }

    function calculateMetrics(dataset) {
        if (dataset.length === 0) {
            return { visitors: 0, pageviews: 0, avgDuration: 0, bounceRate: 0 };
        }

        const pageviews = dataset.length;
        
        // Group by Session ID to parse sessions
        const sessions = {};
        dataset.forEach(r => {
            if (!sessions[r.sessionId]) {
                sessions[r.sessionId] = {
                    views: 0,
                    maxDuration: 0,
                    pages: []
                };
            }
            sessions[r.sessionId].views++;
            sessions[r.sessionId].maxDuration = Math.max(sessions[r.sessionId].maxDuration, r.duration || 0);
            sessions[r.sessionId].pages.push(r.page);
        });

        const visitors = Object.keys(sessions).length;
        
        // Calculate average duration
        let totalDuration = 0;
        let bounceSessions = 0;
        
        Object.values(sessions).forEach(s => {
            totalDuration += s.maxDuration;
            if (s.views === 1) {
                bounceSessions++;
            }
        });

        const avgDuration = visitors > 0 ? (totalDuration / visitors) : 0;
        const bounceRate = visitors > 0 ? ((bounceSessions / visitors) * 100) : 0;

        return { visitors, pageviews, avgDuration, bounceRate };
    }

    function updateKPIs() {
        const currentData = getFilteredData(currentRange);
        const precedingData = getPrecedingData(currentRange);

        const currentMetrics = calculateMetrics(currentData);
        const precedingMetrics = calculateMetrics(precedingData);

        // Animate counter values
        animateCounter(kpiVisitors, currentMetrics.visitors);
        animateCounter(kpiPageviews, currentMetrics.pageviews);
        
        // Special formatting for average duration and bounce rate
        kpiDuration.textContent = formatDuration(currentMetrics.avgDuration);
        kpiBounce.textContent = `${currentMetrics.bounceRate.toFixed(1)}%`;

        // Render Trends
        renderTrendIndicator(trendVisitors, currentMetrics.visitors, precedingMetrics.visitors, false);
        renderTrendIndicator(trendPageviews, currentMetrics.pageviews, precedingMetrics.pageviews, false);
        renderTrendIndicator(trendDuration, currentMetrics.avgDuration, precedingMetrics.avgDuration, false);
        renderTrendIndicator(trendBounce, currentMetrics.bounceRate, precedingMetrics.bounceRate, true); // lower is better
    }

    function animateCounter(element, targetValue) {
        let startValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
        if (startValue === targetValue) {
            element.textContent = targetValue.toLocaleString();
            return;
        }

        const duration = 800; // ms
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out quad
            const easeProgress = progress * (2 - progress);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
            
            element.textContent = currentValue.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = targetValue.toLocaleString();
            }
        }

        requestAnimationFrame(update);
    }

    function renderTrendIndicator(element, current, preceding, isInverse) {
        const trendSpan = element.querySelector('span');
        const trendIcon = element.querySelector('i');
        
        if (preceding === 0) {
            element.style.display = 'none';
            return;
        }
        element.style.display = 'inline-flex';

        const percentChange = ((current - preceding) / preceding) * 100;
        const sign = percentChange >= 0 ? '+' : '';
        trendSpan.textContent = `${sign}${percentChange.toFixed(1)}%`;

        const isPositiveChange = percentChange >= 0;
        const isGoodTrend = isInverse ? !isPositiveChange : isPositiveChange;

        if (isGoodTrend) {
            element.className = 'kpi-trend positive';
            trendIcon.className = percentChange >= 0 ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down';
        } else {
            element.className = 'kpi-trend negative';
            trendIcon.className = percentChange >= 0 ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down';
        }
    }

    // ----------------------------------------------------
    // 5. Chart.js Visualizations
    // ----------------------------------------------------
    function getThemeColors() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const isDark = theme === 'dark';

        return {
            gridLines: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            text: isDark ? '#9ca3af' : '#4b5563',
            tooltipBg: isDark ? '#12161e' : '#ffffff',
            tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            tooltipText: isDark ? '#f3f4f6' : '#1f2937'
        };
    }

    function updateCharts() {
        const data = getFilteredData(currentRange);
        const colors = getThemeColors();

        // -----------------
        // 1. Trend Chart
        // -----------------
        // Group data by Date/Hour
        const dateGroups = {};
        const isShortRange = currentRange === 'today' || currentRange === 'yesterday';

        if (isShortRange) {
            // Group by hour (0 to 23)
            for (let h = 0; h < 24; h++) {
                dateGroups[h] = { visitors: new Set(), pageviews: 0 };
            }
            data.forEach(r => {
                const hour = new Date(r.timestamp).getHours();
                dateGroups[hour].visitors.add(r.sessionId);
                dateGroups[hour].pageviews++;
            });
        } else {
            // Group by date YYYY-MM-DD
            data.forEach(r => {
                const dateStr = new Date(r.timestamp).toISOString().split('T')[0];
                if (!dateGroups[dateStr]) {
                    dateGroups[dateStr] = { visitors: new Set(), pageviews: 0 };
                }
                dateGroups[dateStr].visitors.add(r.sessionId);
                dateGroups[dateStr].pageviews++;
            });
        }

        const labels = [];
        const visitorsData = [];
        const pageviewsData = [];

        Object.keys(dateGroups).sort().forEach(key => {
            if (isShortRange) {
                const h = parseInt(key);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const formattedHour = h % 12 === 0 ? 12 : h % 12;
                labels.push(`${formattedHour} ${ampm}`);
            } else {
                const dateObj = new Date(key);
                labels.push(dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
            }
            visitorsData.push(dateGroups[key].visitors.size);
            pageviewsData.push(dateGroups[key].pageviews);
        });

        // Destroy existing trend chart if active to clear canvas grid bugs
        if (trendChartInstance) {
            trendChartInstance.destroy();
        }

        const ctxTrend = document.getElementById('trendChart').getContext('2d');
        
        // Define beautiful custom gradients for curves
        const gradEmerald = ctxTrend.createLinearGradient(0, 0, 0, 300);
        gradEmerald.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        gradEmerald.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        const gradCyan = ctxTrend.createLinearGradient(0, 0, 0, 300);
        gradCyan.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
        gradCyan.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        trendChartInstance = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Unique Visitors',
                        data: visitorsData,
                        borderColor: '#10b981',
                        backgroundColor: gradEmerald,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#10b981',
                        pointHoverRadius: 7
                    },
                    {
                        label: 'Total Pageviews',
                        data: pageviewsData,
                        borderColor: '#06b6d4',
                        backgroundColor: gradCyan,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointBackgroundColor: '#06b6d4',
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: colors.text,
                            font: { family: 'Plus Jakarta Sans', weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        titleFont: { family: 'Syne', weight: '700' },
                        bodyFont: { family: 'Plus Jakarta Sans' },
                        padding: 12,
                        cornerRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }
                },
                scales: {
                    x: {
                        grid: { color: colors.gridLines },
                        ticks: { color: colors.text, font: { family: 'Plus Jakarta Sans', size: 10 } }
                    },
                    y: {
                        grid: { color: colors.gridLines },
                        ticks: { color: colors.text, font: { family: 'Plus Jakarta Sans', size: 10 } }
                    }
                }
            }
        });

        // -----------------
        // 2. Source Chart
        // -----------------
        const sourceCounts = { 'Search Engine': 0, 'Direct': 0, 'Social Media': 0, 'Other Referral': 0 };
        data.forEach(r => {
            const src = r.referrer || 'Direct';
            if (sourceCounts[src] !== undefined) {
                sourceCounts[src]++;
            }
        });

        if (sourceChartInstance) {
            sourceChartInstance.destroy();
        }

        const ctxSource = document.getElementById('sourceChart').getContext('2d');
        
        sourceChartInstance = new Chart(ctxSource, {
            type: 'doughnut',
            data: {
                labels: Object.keys(sourceCounts),
                datasets: [{
                    data: Object.values(sourceCounts),
                    backgroundColor: [
                        '#10b981', // Search Engine (emerald)
                        '#3b82f6', // Direct (blue)
                        '#06b6d4', // Social Media (cyan)
                        '#f59e0b'  // Other Referral (gold)
                    ],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: colors.text,
                            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
                            padding: 16
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        titleFont: { family: 'Syne', weight: '700' },
                        bodyFont: { family: 'Plus Jakarta Sans' },
                        padding: 12,
                        cornerRadius: 8
                    }
                },
                cutout: '70%'
            }
        });

        // Update the main area chart subtitle based on range
        const chartSub = document.getElementById('chart-trend-subtitle');
        if (isShortRange) {
            chartSub.textContent = `Hourly breakdown of visitor activity for ${currentRange === 'today' ? 'Today' : 'Yesterday'}`;
        } else {
            chartSub.textContent = `Daily count of unique visitors and total pageviews over the last ${currentRange === '7days' ? '7' : '30'} days`;
        }
    }

    // ----------------------------------------------------
    // 6. Geographic Distribution Render
    // ----------------------------------------------------
    function updateGeoRanking(data) {
        countryList.innerHTML = '';
        if (data.length === 0) {
            countryList.innerHTML = `<div class="chart-subtitle" style="text-align: center; padding: 24px;">No geographic data found for this range.</div>`;
            return;
        }

        // Count unique visitors per country & track cities
        const countryStats = {};
        let totalCountryVisitors = 0;

        data.forEach(r => {
            const countryKey = r.country || "Pakistan";
            const countryCode = r.countryCode || "PK";
            const city = r.city || "Sahiwal";

            if (!countryStats[countryKey]) {
                countryStats[countryKey] = {
                    code: countryCode,
                    visitors: new Set(),
                    cities: {}
                };
            }
            countryStats[countryKey].visitors.add(r.sessionId);
            
            if (!countryStats[countryKey].cities[city]) {
                countryStats[countryKey].cities[city] = 0;
            }
            countryStats[countryKey].cities[city]++;
        });

        // Convert to array and sort
        const rankedCountries = Object.keys(countryStats).map(c => {
            const visitorsCount = countryStats[c].visitors.size;
            totalCountryVisitors += visitorsCount;

            // Sort top cities
            const topCities = Object.keys(countryStats[c].cities)
                .map(city => ({ name: city, count: countryStats[c].cities[city] }))
                .sort((a,b) => b.count - a.count)
                .slice(0, 2)
                .map(city => city.name)
                .join(', ');

            return {
                name: c,
                code: countryStats[c].code,
                visitors: visitorsCount,
                cities: topCities
            };
        }).sort((a, b) => b.visitors - a.visitors);

        // Append HTML rows with flag CDN URLs and progress bars
        rankedCountries.forEach(c => {
            const pct = totalCountryVisitors > 0 ? ((c.visitors / totalCountryVisitors) * 100) : 0;
            const flagUrl = `https://flagcdn.com/w40/${c.code.toLowerCase()}.png`;

            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.innerHTML = `
                <div class="ranking-info">
                    <span class="ranking-label">
                        <img src="${flagUrl}" alt="${c.name} Flag" onerror="this.style.display='none'">
                        <span>${c.name} <small style="color: var(--text-muted); font-weight: normal;">(${c.cities})</small></span>
                    </span>
                    <span class="ranking-count">
                        <strong class="ranking-percent">${pct.toFixed(1)}%</strong>
                        <span style="margin-left: 6px;">(${c.visitors} users)</span>
                    </span>
                </div>
                <div class="ranking-bar-bg">
                    <div class="ranking-bar-fill" style="width: 0%; background: var(--grad-blue);"></div>
                </div>
            `;

            countryList.appendChild(item);

            // Animate progress bar fill in next tick
            setTimeout(() => {
                const fill = item.querySelector('.ranking-bar-fill');
                if (fill) fill.style.width = `${pct}%`;
            }, 50);
        });
    }

    // ----------------------------------------------------
    // 7. Tech Stack Breakdown Render (OS, Phone, Browser, Pages)
    // ----------------------------------------------------
    function updateTechStackRankings(data) {
        // Clear all list targets
        deviceList.innerHTML = '';
        phoneList.innerHTML = '';
        browserList.innerHTML = '';
        pagesList.innerHTML = '';

        if (data.length === 0) return;

        // --- 1. OS & Device Types ---
        const deviceStats = { Desktop: 0, Mobile: 0, Tablet: 0 };
        const osStats = { Windows: 0, macOS: 0, Android: 0, iOS: 0, Linux: 0, Other: 0 };
        let totalSessions = 0;
        
        // Let's filter distinct sessions for devices to avoid counting pageviews
        const sessionDeviceOS = {};
        data.forEach(r => {
            if (!sessionDeviceOS[r.sessionId]) {
                sessionDeviceOS[r.sessionId] = { device: r.device || 'Desktop', os: r.os || 'Windows' };
            }
        });

        const distinctSessions = Object.values(sessionDeviceOS);
        distinctSessions.forEach(s => {
            totalSessions++;
            if (deviceStats[s.device] !== undefined) deviceStats[s.device]++;
            if (osStats[s.os] !== undefined) osStats[s.os]++;
            else osStats['Other']++;
        });

        // Render Device Types bars
        const deviceIcons = { Desktop: 'fa-desktop', Mobile: 'fa-mobile-screen-button', Tablet: 'fa-tablet-screen-button' };
        Object.keys(deviceStats).forEach(key => {
            const count = deviceStats[key];
            const pct = totalSessions > 0 ? ((count / totalSessions) * 100) : 0;

            const row = document.createElement('div');
            row.className = 'device-row';
            row.innerHTML = `
                <div class="device-icon-label">
                    <div class="device-icon"><i class="fa-solid ${deviceIcons[key]}"></i></div>
                    <span>${key}</span>
                </div>
                <div class="ranking-bar-bg" style="flex-grow: 1; margin: 0 10px;">
                    <div class="device-bar-fill" style="width: 0%; background: var(--grad-emerald);"></div>
                </div>
                <span class="ranking-percent" style="width: 45px; text-align: right;">${pct.toFixed(0)}%</span>
            `;
            deviceList.appendChild(row);

            setTimeout(() => {
                const fill = row.querySelector('.device-bar-fill');
                if (fill) fill.style.width = `${pct}%`;
            }, 50);
        });

        // Add small OS badges under device types list
        const osBadgeWrapper = document.createElement('div');
        osBadgeWrapper.style.display = 'flex';
        osBadgeWrapper.style.gap = '8px';
        osBadgeWrapper.style.flexWrap = 'wrap';
        osBadgeWrapper.style.marginTop = '6px';
        
        const osIcons = { Windows: 'fa-windows', macOS: 'fa-apple', Android: 'fa-android', iOS: 'fa-apple', Linux: 'fa-linux' };
        
        Object.keys(osStats).sort((a,b) => osStats[b] - osStats[a]).forEach(os => {
            const count = osStats[os];
            if (count === 0) return;
            const pct = totalSessions > 0 ? ((count / totalSessions) * 100) : 0;
            
            const badge = document.createElement('span');
            badge.style.fontSize = '11px';
            badge.style.padding = '3px 8px';
            badge.style.background = 'rgba(255, 255, 255, 0.04)';
            badge.style.border = '1px solid var(--border-color)';
            badge.style.borderRadius = '20px';
            badge.style.color = 'var(--text-secondary)';
            badge.style.display = 'inline-flex';
            badge.style.alignItems = 'center';
            badge.style.gap = '4px';

            const brandIcon = osIcons[os] ? `<i class="fa-brands ${osIcons[os]}"></i>` : `<i class="fa-solid fa-laptop"></i>`;
            badge.innerHTML = `${brandIcon} <span>${os} (${pct.toFixed(0)}%)</span>`;
            
            osBadgeWrapper.appendChild(badge);
        });
        deviceList.appendChild(osBadgeWrapper);

        // --- 2. Mobile Brands & Phone Models ---
        const phoneStats = {};
        let totalMobiles = 0;
        data.forEach(r => {
            if (r.device === "Mobile" && r.phoneModel && r.phoneModel !== "Android Mobile" && r.phoneModel !== "iPhone Mobile") {
                totalMobiles++;
                if (!phoneStats[r.phoneModel]) phoneStats[r.phoneModel] = 0;
                phoneStats[r.phoneModel]++;
            }
        });

        const rankedPhones = Object.keys(phoneStats).map(p => ({
            name: p,
            count: phoneStats[p]
        })).sort((a,b) => b.count - a.count).slice(0, 4);

        if (rankedPhones.length === 0) {
            phoneList.innerHTML = `<div class="chart-subtitle" style="text-align: center; padding: 12px 0;">No phone-specific details parsed.</div>`;
        } else {
            rankedPhones.forEach(p => {
                const pct = totalMobiles > 0 ? ((p.count / totalMobiles) * 100) : 0;
                const row = document.createElement('div');
                row.className = 'ranking-item';
                row.style.gap = '2px';
                row.innerHTML = `
                    <div class="ranking-info" style="font-size: 11px;">
                        <span class="ranking-label"><i class="fa-solid fa-mobile-button text-muted" style="font-size:10px;"></i> ${p.name}</span>
                        <span class="ranking-count" style="font-weight:700; color:var(--text-primary);">${pct.toFixed(0)}%</span>
                    </div>
                `;
                phoneList.appendChild(row);
            });
        }

        // --- 3. Browsers Breakdown ---
        const browserStats = { Chrome: 0, Safari: 0, Firefox: 0, Edge: 0, Opera: 0 };
        let totalBrowsers = 0;
        data.forEach(r => {
            totalBrowsers++;
            if (browserStats[r.browser] !== undefined) {
                browserStats[r.browser]++;
            }
        });

        const browserIcons = { Chrome: 'fa-chrome chrome-icon', Safari: 'fa-safari safari-icon', Firefox: 'fa-firefox-browser firefox-icon', Edge: 'fa-edge edge-icon', Opera: 'fa-opera opera-icon' };
        
        Object.keys(browserStats).forEach(b => {
            const count = browserStats[b];
            const pct = totalBrowsers > 0 ? ((count / totalBrowsers) * 100) : 0;
            const iconClass = browserIcons[b] || 'fa-globe text-secondary';

            const box = document.createElement('div');
            box.className = 'browser-box';
            box.innerHTML = `
                <i class="fa-brands ${iconClass}"></i>
                <div class="browser-name">${b}</div>
                <div class="browser-percent">${pct.toFixed(0)}%</div>
            `;
            browserList.appendChild(box);
        });

        // --- 4. Most Visited Sections ---
        const pageStats = {};
        let totalViews = 0;
        data.forEach(r => {
            totalViews++;
            if (!pageStats[r.page]) pageStats[r.page] = 0;
            pageStats[r.page]++;
        });

        const rankedPages = Object.keys(pageStats).map(p => ({
            name: p,
            count: pageStats[p]
        })).sort((a,b) => b.count - a.count);

        rankedPages.forEach(p => {
            const pct = totalViews > 0 ? ((p.count / totalViews) * 100) : 0;
            const row = document.createElement('div');
            row.className = 'ranking-item';
            row.style.gap = '2px';
            row.innerHTML = `
                <div class="ranking-info" style="font-size: 11px;">
                    <span class="ranking-label"><span class="stream-target-page" style="padding: 1px 4px; font-size:10px;">/${p.name.toLowerCase()}</span></span>
                    <span class="ranking-count"><strong>${pct.toFixed(0)}%</strong> <small style="color:var(--text-muted)">(${p.count})</small></span>
                </div>
            `;
            pagesList.appendChild(row);
        });
    }

    // ----------------------------------------------------
    // 8. Real-Time Activity Log Stream Render
    // ----------------------------------------------------
    function getRelativeTimeString(timestamp) {
        const diffMs = Date.now() - timestamp;
        if (diffMs < 0) return "Just now";
        
        const diffSecs = Math.floor(diffMs / 1000);
        if (diffSecs < 10) return "Just now";
        if (diffSecs < 60) return `${diffSecs}s ago`;

        const diffMins = Math.floor(diffSecs / 60);
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        // Default date format
        return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function renderActivityStream(data) {
        streamContainer.innerHTML = '';
        
        // Grab last 15 active actions sorted descending by timestamp
        const streamData = [...data].sort((a,b) => b.timestamp - a.timestamp).slice(0, 15);

        if (streamData.length === 0) {
            streamContainer.innerHTML = `<div class="chart-subtitle" style="text-align: center; padding: 24px;">No visitor telemetry stream logs recorded yet.</div>`;
            return;
        }

        const deviceIcons = { Desktop: 'fa-desktop', Mobile: 'fa-mobile-screen-button', Tablet: 'fa-tablet-screen-button' };

        streamData.forEach(r => {
            const timeStr = getRelativeTimeString(r.timestamp);
            const flagUrl = `https://flagcdn.com/w40/${r.countryCode.toLowerCase()}.png`;
            const devIcon = deviceIcons[r.device] || 'fa-laptop';

            // Create initial characters as avatar placeholder
            const initial = r.city.charAt(0);

            const row = document.createElement('div');
            row.className = 'stream-row';
            row.setAttribute('data-id', r.id);
            row.innerHTML = `
                <div class="stream-left">
                    <div class="stream-avatar">${initial}</div>
                    <div class="stream-info">
                        <div class="stream-location">
                            <img src="${flagUrl}" alt="${r.country}" style="width:16px; height:11px; object-fit:cover; border-radius:1px;">
                            <span>${r.city}, ${r.country}</span>
                        </div>
                        <div class="stream-action">
                            <span>Viewed page section</span>
                            <span class="stream-target-page">/${r.page.toLowerCase()}</span>
                            ${r.duration > 0 ? `<small style="color:var(--text-muted); margin-left: 6px;"><i class="fa-regular fa-clock"></i> spent ${formatDuration(r.duration)}</small>` : ''}
                        </div>
                    </div>
                </div>
                <div class="stream-meta">
                    <span class="stream-device-badge" title="${r.phoneModel} / ${r.browser} ${r.browserVersion}">
                        <i class="fa-solid ${devIcon}"></i>
                        <span>${r.os} (${r.browser})</span>
                    </span>
                    <span class="stream-time" data-time="${r.timestamp}">${timeStr}</span>
                </div>
            `;

            streamContainer.appendChild(row);
        });
    }

    // Dynamic timer checking and updating relative strings every 5 seconds
    setInterval(() => {
        const timeBadges = streamContainer.querySelectorAll('.stream-time');
        timeBadges.forEach(b => {
            const ts = parseInt(b.getAttribute('data-time'));
            if (ts) {
                b.textContent = getRelativeTimeString(ts);
            }
        });
    }, 5000);

    // Update active user online count badge
    function refreshLiveOnlineCount() {
        const stored = localStorage.getItem('zen_active_visitors_count') || '5';
        liveOnlineCount.textContent = stored;
    }
    refreshLiveOnlineCount();

    // ----------------------------------------------------
    // 9. Interactive Actions (Simulate, Export, Reset, Filters)
    // ----------------------------------------------------
    function triggerSimulation() {
        btnSimulate.disabled = true;
        const icon = btnSimulate.querySelector('i');
        icon.className = 'fa-solid fa-spinner fa-spin';

        setTimeout(() => {
            const record = window.ZenAnalytics.generateLiveSimulatedVisit();
            
            // Re-render
            updateDashboard();

            // Flash toast notification
            showToast(`
                <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--color-cyan)"></i>
                <span><strong>New telemetry simulated!</strong> Visitor from ${record.city}, ${record.countryCode} viewed /${record.page.toLowerCase()}</span>
            `);

            btnSimulate.disabled = false;
            icon.className = 'fa-solid fa-wand-magic-sparkles';
        }, 600);
    }

    btnSimulate.addEventListener('click', triggerSimulation);

    // Export Data Action
    btnExport.addEventListener('click', () => {
        const db = window.ZenAnalytics.getDb();
        const jsonStr = JSON.stringify(db, null, 2);
        
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `zenpexels_analytics_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('<i class="fa-solid fa-file-arrow-down"></i> Raw JSON Database exported successfully!');
    });

    // Reset Data Action
    btnReset.addEventListener('click', () => {
        if (confirm("Are you sure you want to reset all analytics? This will wipe localStorage data and regenerate fresh historical telemetry!")) {
            const db = window.ZenAnalytics.resetDb();
            updateDashboard();
            showToast('<i class="fa-solid fa-arrows-rotate"></i> Database purged! Clean 30-day history regenerated.');
        }
    });

    // Date Range Filters Click
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentRange = btn.getAttribute('data-range');
            updateDashboard();
            showToast(`<i class="fa-solid fa-calendar-day"></i> Filter changed to <strong>${btn.textContent}</strong>`);
        });
    });

    // ----------------------------------------------------
    // 10. Live Synced Event Listeners (Same browser, other tabs)
    // ----------------------------------------------------
    window.addEventListener('zen_analytics_new_visit', () => {
        updateDashboard();
    });

    window.addEventListener('zen_analytics_new_pageview', () => {
        updateDashboard();
    });

    window.addEventListener('zen_analytics_duration_update', (e) => {
        // Find if that visit element is in the stream list and update duration directly
        const row = streamContainer.querySelector(`.stream-row[data-id="${e.detail.id}"]`);
        if (row) {
            const durationLabel = row.querySelector('.stream-action small');
            if (durationLabel) {
                durationLabel.innerHTML = `<i class="fa-regular fa-clock"></i> spent ${formatDuration(e.detail.duration)}`;
            } else {
                const actionDiv = row.querySelector('.stream-action');
                if (actionDiv) {
                    const small = document.createElement('small');
                    small.style.color = 'var(--text-muted)';
                    small.style.marginLeft = '6px';
                    small.innerHTML = `<i class="fa-regular fa-clock"></i> spent ${formatDuration(e.detail.duration)}`;
                    actionDiv.appendChild(small);
                }
            }
        }
    });

    window.addEventListener('zen_analytics_active_users_update', (e) => {
        liveOnlineCount.textContent = e.detail;
        
        // Add flash animation
        liveOnlineCount.parentElement.style.transform = 'scale(1.05)';
        liveOnlineCount.parentElement.style.transition = 'transform 0.2s';
        setTimeout(() => {
            liveOnlineCount.parentElement.style.transform = 'scale(1)';
        }, 200);
    });

    // ----------------------------------------------------
    // 11. Initial Startup & Dashboard Rendering
    // ----------------------------------------------------
    function updateDashboard() {
        const currentData = getFilteredData(currentRange);
        
        updateKPIs();
        updateCharts();
        updateGeoRanking(currentData);
        updateTechStackRankings(currentData);
        renderActivityStream(currentData);
        refreshLiveOnlineCount();
    }

    // Run Initial Update
    updateDashboard();

    // ----------------------------------------------------
    // 12. Periodic Background Visitor Simulation (Autopilot demo)
    // ----------------------------------------------------
    // Automatically generate a visitor every 40 seconds to make the page look alive and scrolling!
    autoSimulateInterval = setInterval(() => {
        // Only run if tab is visible to save battery/cycles
        if (document.visibilityState === 'visible') {
            const record = window.ZenAnalytics.generateLiveSimulatedVisit();
            updateDashboard();
            
            // Pop notification toast
            showToast(`
                <i class="fa-solid fa-circle-nodes" style="color: var(--color-emerald)"></i>
                <span>Live visitor telemetry received from <strong>${record.city}, ${record.countryCode}</strong></span>
            `);
        }
    }, 40000);
});
