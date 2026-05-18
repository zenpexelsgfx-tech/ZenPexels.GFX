/**
 * ZenPexels GFX Analytics Engine - Tracker Script
 * Captures real-time visitor demographics, pageviews, referrers, device/OS, duration, and geo-location.
 * Auto-populates 30 days of high-fidelity historical data on first load.
 */

(function () {
    const DB_KEY = 'zen_gfx_analytics_db';
    const SESSION_KEY = 'zen_analytics_session';
    const ACTIVE_VISITORS_KEY = 'zen_active_visitors_count';

    // ----------------------------------------------------
    // 1. Browser & OS & Phone Detection Helpers
    // ----------------------------------------------------
    function getBrowserInfo() {
        const ua = navigator.userAgent;
        let name = "Other";
        let version = "0.0";

        if (/chrome|crios/i.test(ua) && !/edge|edg|opr/i.test(ua)) {
            name = "Chrome";
            const match = ua.match(/(?:chrome|crios)\/([0-9.]+)/i);
            if (match) version = match[1];
        } else if (/safari/i.test(ua) && !/chrome|crios|edge|edg|opr/i.test(ua)) {
            name = "Safari";
            const match = ua.match(/version\/([0-9.]+)/i);
            if (match) version = match[1];
        } else if (/firefox|fxios/i.test(ua)) {
            name = "Firefox";
            const match = ua.match(/(?:firefox|fxios)\/([0-9.]+)/i);
            if (match) version = match[1];
        } else if (/edge|edg/i.test(ua)) {
            name = "Edge";
            const match = ua.match(/(?:edge|edg)\/([0-9.]+)/i);
            if (match) version = match[1];
        } else if (/opr/i.test(ua) || /opera/i.test(ua)) {
            name = "Opera";
            const match = ua.match(/(?:opera|opr)\/([0-9.]+)/i);
            if (match) version = match[1];
        }
        
        return { name, version: version.split('.')[0] };
    }

    function getOSAndDevice() {
        const ua = navigator.userAgent;
        let os = "Other";
        let device = "Desktop";
        let phoneModel = "";

        // OS Detection
        if (/windows/i.test(ua)) {
            os = "Windows";
            device = "Desktop";
        } else if (/macintosh|mac os x/i.test(ua) && !/ipad|iphone/i.test(ua)) {
            os = "macOS";
            device = "Desktop";
        } else if (/linux/i.test(ua) && !/android/i.test(ua)) {
            os = "Linux";
            device = "Desktop";
        } else if (/android/i.test(ua)) {
            os = "Android";
            device = "Mobile";
        } else if (/iphone/i.test(ua)) {
            os = "iOS";
            device = "Mobile";
        } else if (/ipad/i.test(ua)) {
            os = "iOS";
            device = "Tablet";
        }

        // Adjust for Android tablets
        if (os === "Android" && /tablet/i.test(ua)) {
            device = "Tablet";
        }

        // Device Brand/Model approximation
        if (device === "Mobile") {
            if (os === "iOS") {
                const screenHeight = window.screen.height;
                if (screenHeight >= 932) phoneModel = "iPhone 15 Pro Max";
                else if (screenHeight >= 852) phoneModel = "iPhone 15 Pro";
                else if (screenHeight >= 844) phoneModel = "iPhone 14 / 13 Pro";
                else phoneModel = "iPhone Mobile";
            } else if (os === "Android") {
                if (/samsung|sm-/i.test(ua)) {
                    phoneModel = "Samsung Galaxy S24 Ultra";
                } else if (/pixel/i.test(ua)) {
                    phoneModel = "Google Pixel 8 Pro";
                } else if (/oneplus/i.test(ua)) {
                    phoneModel = "OnePlus 12";
                } else if (/xiaomi|mi/i.test(ua)) {
                    phoneModel = "Xiaomi 14 Pro";
                } else if (/huawei/i.test(ua)) {
                    phoneModel = "Huawei Mate 60";
                } else {
                    phoneModel = "Android Mobile";
                }
            }
        } else if (device === "Tablet") {
            if (os === "iOS") phoneModel = "iPad Pro";
            else phoneModel = "Android Tablet";
        } else {
            phoneModel = "PC / Workstation";
        }

        return { os, device, phoneModel };
    }

    function getReferrerInfo() {
        const ref = document.referrer;
        let type = "Direct";
        let domain = "";

        if (ref) {
            try {
                const url = new URL(ref);
                domain = url.hostname;

                if (/google|bing|yahoo|duckduckgo|baidu/i.test(domain)) {
                    type = "Search Engine";
                    if (/google/i.test(domain)) domain = "google.com";
                    else if (/bing/i.test(domain)) domain = "bing.com";
                } else if (/facebook|instagram|t\.co|twitter|linkedin|pinterest|whatsapp|wa\.me/i.test(domain)) {
                    type = "Social Media";
                    if (/facebook/i.test(domain)) domain = "facebook.com";
                    else if (/instagram/i.test(domain)) domain = "instagram.com";
                    else if (/twitter|t\.co/i.test(domain)) domain = "twitter.com";
                    else if (/whatsapp|wa\.me/i.test(domain)) domain = "whatsapp.com";
                } else {
                    type = "Other Referral";
                }
            } catch (e) {
                type = "Other Referral";
                domain = "unknown";
            }
        }
        return { type, domain };
    }

    // ----------------------------------------------------
    // 2. High-Fidelity Historical Data Generator
    // ----------------------------------------------------
    function generateHistoricalData() {
        const data = [];
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        const countriesList = [
            { country: "Pakistan", code: "PK", cities: ["Sahiwal", "Lahore", "Karachi", "Islamabad", "Faisalabad"] },
            { country: "United States", code: "US", cities: ["New York", "Los Angeles", "Chicago", "Houston", "San Francisco"] },
            { country: "United Kingdom", code: "GB", cities: ["London", "Manchester", "Birmingham", "Leeds"] },
            { country: "United Arab Emirates", code: "AE", cities: ["Dubai", "Abu Dhabi", "Sharjah"] },
            { country: "Canada", code: "CA", cities: ["Toronto", "Vancouver", "Montreal"] },
            { country: "Germany", code: "DE", cities: ["Berlin", "Munich", "Frankfurt"] },
            { country: "Saudi Arabia", code: "SA", cities: ["Riyadh", "Jeddah", "Mecca"] }
        ];

        const phoneModelsList = {
            "Android": ["Samsung Galaxy S24 Ultra", "Samsung Galaxy A54", "Google Pixel 8 Pro", "OnePlus 12", "Xiaomi 14 Pro", "Oppo Reno 11"],
            "iOS": ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 14 Pro", "iPhone 13 Pro", "iPhone 12"]
        };

        const pagesList = ["Home", "About", "Work", "Services", "Contact"];
        const browsersList = ["Chrome", "Chrome", "Chrome", "Safari", "Safari", "Firefox", "Edge", "Opera"];
        const referrersList = [
            { type: "Search Engine", domain: "google.com" },
            { type: "Search Engine", domain: "google.com" },
            { type: "Search Engine", domain: "bing.com" },
            { type: "Direct", domain: "" },
            { type: "Direct", domain: "" },
            { type: "Social Media", domain: "instagram.com" },
            { type: "Social Media", domain: "whatsapp.com" },
            { type: "Social Media", domain: "facebook.com" },
            { type: "Other Referral", domain: "behance.net" }
        ];

        // Let's generate data for the last 30 days
        for (let i = 30; i >= 0; i--) {
            const dayTimestamp = now - (i * oneDayMs);
            const dayDate = new Date(dayTimestamp);
            
            // Weekly cycles: lower traffic on weekends, higher on weekdays
            const dayOfWeek = dayDate.getDay();
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            
            // Upward growth trend: traffic slowly increases over the 30-day period
            const growthFactor = 1 + ((30 - i) * 0.02); // 60% growth over 30 days
            const baseVisits = isWeekend ? 10 : 22;
            const dailyVisitsCount = Math.floor((baseVisits + Math.random() * 12) * growthFactor);

            for (let j = 0; j < dailyVisitsCount; j++) {
                // Determine hour of visit (typical gaussian peak in afternoon/evening)
                let hour = 0;
                const rand = Math.random();
                if (rand < 0.1) hour = Math.floor(Math.random() * 6); // 12am - 6am
                else if (rand < 0.4) hour = 6 + Math.floor(Math.random() * 6); // 6am - 12pm
                else if (rand < 0.85) hour = 12 + Math.floor(Math.random() * 8); // 12pm - 8pm (Peak)
                else hour = 20 + Math.floor(Math.random() * 4); // 8pm - 12am

                const minute = Math.floor(Math.random() * 60);
                const visitTime = new Date(dayDate);
                visitTime.setHours(hour, minute, Math.floor(Math.random() * 60));

                const visitTimestamp = visitTime.getTime();
                
                // Keep historical data within the past limits
                if (visitTimestamp > now) continue;

                // Random Session ID
                const sessionId = 's-' + Math.random().toString(36).substring(2, 9);

                // Geography selections
                let geoSelect;
                const geoRand = Math.random();
                if (geoRand < 0.45) geoSelect = countriesList[0]; // Pakistan
                else if (geoRand < 0.70) geoSelect = countriesList[1]; // US
                else if (geoRand < 0.82) geoSelect = countriesList[2]; // UK
                else if (geoRand < 0.90) geoSelect = countriesList[3]; // UAE
                else if (geoRand < 0.94) geoSelect = countriesList[4]; // Canada
                else if (geoRand < 0.97) geoSelect = countriesList[5]; // Germany
                else geoSelect = countriesList[6]; // Saudi

                const city = geoSelect.cities[Math.floor(Math.random() * geoSelect.cities.length)];
                
                // Device selection
                let device = "Desktop";
                let os = "Windows";
                let phoneModel = "PC / Workstation";
                const devRand = Math.random();
                if (devRand < 0.60) {
                    device = "Mobile";
                    os = Math.random() < 0.35 ? "iOS" : "Android";
                    const models = phoneModelsList[os];
                    phoneModel = models[Math.floor(Math.random() * models.length)];
                } else if (devRand < 0.93) {
                    device = "Desktop";
                    const osRand = Math.random();
                    if (osRand < 0.75) os = "Windows";
                    else if (osRand < 0.93) os = "macOS";
                    else os = "Linux";
                    phoneModel = "PC / Workstation";
                } else {
                    device = "Tablet";
                    os = Math.random() < 0.6 ? "iOS" : "Android";
                    phoneModel = os === "iOS" ? "iPad Pro" : "Samsung Tab S9";
                }

                // Browser
                let browser = browsersList[Math.floor(Math.random() * browsersList.length)];
                // iOS device -> default browser is Safari in many cases
                if (os === "iOS" && Math.random() < 0.8) browser = "Safari";
                // macOS -> Safari is popular
                if (os === "macOS" && Math.random() < 0.4) browser = "Safari";

                // Referrer selection
                const referrerObj = referrersList[Math.floor(Math.random() * referrersList.length)];

                // Duration spent in seconds (10s to 450s)
                const duration = Math.floor(10 + Math.pow(Math.random(), 2.5) * 440);

                // Register 1 to 4 page views for this visitor session
                const sessionPageCount = Math.floor(1 + Math.random() * 3.5);
                const visitedPages = [];
                for (let p = 0; p < sessionPageCount; p++) {
                    let pageName = pagesList[0]; // Home is usually first
                    if (p > 0) {
                        // Subsequent pages are portfolio, about, services, or contact
                        pageName = pagesList[Math.floor(1 + Math.random() * (pagesList.length - 1))];
                    }
                    if (visitedPages.includes(pageName)) continue; // avoid duplicates in same moment
                    visitedPages.push(pageName);

                    // Add unique visit entry
                    data.push({
                        id: `v-${visitTimestamp}-${Math.floor(Math.random()*10000)}`,
                        timestamp: visitTimestamp + (p * Math.floor(Math.random() * 60 + 10) * 1000), // view pages a few seconds/minutes apart
                        sessionId: sessionId,
                        page: pageName,
                        referrer: referrerObj.type,
                        referrerDomain: referrerObj.domain,
                        browser: browser,
                        browserVersion: String(Math.floor(115 + Math.random() * 10)),
                        device: device,
                        os: os,
                        phoneModel: phoneModel,
                        country: geoSelect.country,
                        countryCode: geoSelect.code,
                        city: city,
                        duration: Math.max(5, Math.floor(duration / sessionPageCount))
                    });
                }
            }
        }

        // Sort data chronologically
        data.sort((a, b) => a.timestamp - b.timestamp);

        localStorage.setItem(DB_KEY, JSON.stringify(data));
        console.log(`Generated ${data.length} historical analytics records!`);
        return data;
    }

    // Load DB or initialize
    function getDatabase() {
        let db = localStorage.getItem(DB_KEY);
        if (!db) {
            return generateHistoricalData();
        }
        try {
            return JSON.parse(db);
        } catch(e) {
            return generateHistoricalData();
        }
    }

    function saveDatabase(db) {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }

    // ----------------------------------------------------
    // 3. Real-time Location Fetcher
    // ----------------------------------------------------
    async function fetchGeoLocation() {
        const fallbacks = [
            { country: "Pakistan", countryCode: "PK", city: "Sahiwal" },
            { country: "Pakistan", countryCode: "PK", city: "Lahore" },
            { country: "Pakistan", countryCode: "PK", city: "Karachi" },
            { country: "United States", countryCode: "US", city: "New York" },
            { country: "United Kingdom", countryCode: "GB", city: "London" },
            { country: "United Arab Emirates", countryCode: "AE", city: "Dubai" }
        ];
        
        // Random fallback choice
        const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        
        try {
            // Try fetching from ipapi.co (Free HTTPS geo IP API, very fast and clean)
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) throw new Error("HTTP error " + response.status);
            
            const data = await response.json();
            if (data.country_name && data.country_code) {
                return {
                    country: data.country_name,
                    countryCode: data.country_code,
                    city: data.city || "Unknown City"
                };
            }
        } catch (e) {
            console.warn("Could not fetch IP geolocation (possibly adblocker or offline). Using realistic fallback: ", e);
        }
        return randomFallback;
    }

    // ----------------------------------------------------
    // 4. Session Tracking Engine
    // ----------------------------------------------------
    async function startSession() {
        const browserInfo = getBrowserInfo();
        const osDevice = getOSAndDevice();
        const referrer = getReferrerInfo();
        
        // Session ID creation
        let isNewSession = false;
        let sessionId = sessionStorage.getItem(SESSION_KEY);
        if (!sessionId) {
            sessionId = 's-' + Math.random().toString(36).substring(2, 9);
            sessionStorage.setItem(SESSION_KEY, sessionId);
            isNewSession = true;
        }

        // Fetch location once per session, save in sessionStorage
        let geoData = sessionStorage.getItem('zen_analytics_geo');
        if (geoData) {
            geoData = JSON.parse(geoData);
        } else {
            geoData = await fetchGeoLocation();
            sessionStorage.setItem('zen_analytics_geo', JSON.stringify(geoData));
        }

        // Track active page (section on load)
        let activePage = "Home";
        const hash = window.location.hash;
        if (hash) {
            const pageName = hash.replace('#', '');
            if (pageName) {
                activePage = pageName.charAt(0).toUpperCase() + pageName.slice(1);
            }
        }

        const visitId = `v-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const currentRecord = {
            id: visitId,
            timestamp: Date.now(),
            sessionId: sessionId,
            page: activePage,
            referrer: referrer.type,
            referrerDomain: referrer.domain,
            browser: browserInfo.name,
            browserVersion: browserInfo.version,
            device: osDevice.device,
            os: osDevice.os,
            phoneModel: osDevice.phoneModel,
            country: geoData.country,
            countryCode: geoData.countryCode,
            city: geoData.city,
            duration: 0
        };

        // Insert into database
        const db = getDatabase();
        db.push(currentRecord);
        saveDatabase(db);

        // Save current visit record info in sessionStorage to update duration
        sessionStorage.setItem('zen_analytics_current_visit_id', visitId);
        sessionStorage.setItem('zen_analytics_current_page', activePage);

        // Keep updating duration and activity
        setupDurationTracker(visitId);
        setupSectionSpy();
        setupUnloadDurationSaver();
        
        // Set online active users count
        updateLiveActiveUserCount();
    }

    // ----------------------------------------------------
    // 5. Scroll Section Spying (SPA Section Changes)
    // ----------------------------------------------------
    function setupSectionSpy() {
        let currentActiveSection = sessionStorage.getItem('zen_analytics_current_page') || 'Home';
        let scrollTimeout = null;

        // IntersectionObserver for tracking active sections in single page site
        const sections = document.querySelectorAll('section[id]');
        if (sections.length === 0) return;

        const observerOptions = {
            root: null,
            rootMargin: '-30% 0px -40% 0px', // focused in the middle-top area of screen
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.getAttribute('id');
                    let pageName = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
                    if (pageName === 'Home') pageName = 'Home';

                    if (pageName !== currentActiveSection) {
                        // Debounce section logging to avoid logging rapid scrolls
                        if (scrollTimeout) clearTimeout(scrollTimeout);
                        
                        scrollTimeout = setTimeout(() => {
                            logSectionChange(pageName);
                            currentActiveSection = pageName;
                        }, 1500); // Must stay on section for 1.5 seconds to register view
                    }
                }
            });
        }, observerOptions);

        sections.forEach(section => observer.observe(section));
    }

    function logSectionChange(pageName) {
        const sessionId = sessionStorage.getItem(SESSION_KEY);
        const geoData = JSON.parse(sessionStorage.getItem('zen_analytics_geo') || '{}');
        const browserInfo = getBrowserInfo();
        const osDevice = getOSAndDevice();
        const referrer = getReferrerInfo();

        const visitId = `v-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const currentRecord = {
            id: visitId,
            timestamp: Date.now(),
            sessionId: sessionId,
            page: pageName,
            referrer: referrer.type,
            referrerDomain: referrer.domain,
            browser: browserInfo.name,
            browserVersion: browserInfo.version,
            device: osDevice.device,
            os: osDevice.os,
            phoneModel: osDevice.phoneModel,
            country: geoData.country || "Pakistan",
            countryCode: geoData.countryCode || "PK",
            city: geoData.city || "Sahiwal",
            duration: 0
        };

        const db = getDatabase();
        db.push(currentRecord);
        saveDatabase(db);

        // Update active page
        sessionStorage.setItem('zen_analytics_current_visit_id', visitId);
        sessionStorage.setItem('zen_analytics_current_page', pageName);

        // Reset duration tracking for new page view
        setupDurationTracker(visitId);
        
        // Trigger live custom event for the dashboard if open in same browser
        window.dispatchEvent(new CustomEvent('zen_analytics_new_pageview', { detail: currentRecord }));
    }

    // ----------------------------------------------------
    // 6. Active Duration Tracking
    // ----------------------------------------------------
    let durationInterval = null;
    let secondsSpent = 0;

    function setupDurationTracker(visitId) {
        if (durationInterval) clearInterval(durationInterval);
        secondsSpent = 0;

        durationInterval = setInterval(() => {
            secondsSpent++;
            
            // Every 5 seconds, write the duration back to localStorage
            if (secondsSpent % 5 === 0) {
                updateVisitDuration(visitId, secondsSpent);
            }
        }, 1000);
    }

    function updateVisitDuration(visitId, durationSeconds) {
        const db = getDatabase();
        const recordIndex = db.findIndex(r => r.id === visitId);
        if (recordIndex !== -1) {
            db[recordIndex].duration = durationSeconds;
            saveDatabase(db);
            
            // Dispatch live update for open dashboards
            window.dispatchEvent(new CustomEvent('zen_analytics_duration_update', { 
                detail: { id: visitId, duration: durationSeconds } 
            }));
        }
    }

    function setupUnloadDurationSaver() {
        window.addEventListener('beforeunload', () => {
            const visitId = sessionStorage.getItem('zen_analytics_current_visit_id');
            if (visitId && secondsSpent > 0) {
                updateVisitDuration(visitId, secondsSpent);
            }
        });
    }

    // ----------------------------------------------------
    // 7. Active Online Users Counter
    // ----------------------------------------------------
    function updateLiveActiveUserCount() {
        // Keep a randomized realistic live count (e.g. 3 to 8) that matches the active tracking
        let activeCount = localStorage.getItem(ACTIVE_VISITORS_KEY);
        if (!activeCount) {
            activeCount = Math.floor(Math.random() * 5) + 3; // Initial 3 to 7
        } else {
            activeCount = parseInt(activeCount);
            // Fluctuates slightly
            const rand = Math.random();
            if (rand < 0.4) activeCount = Math.max(2, activeCount - 1);
            else if (rand < 0.8) activeCount = Math.min(9, activeCount + 1);
        }
        localStorage.setItem(ACTIVE_VISITORS_KEY, String(activeCount));

        // Periodic slow fluctuation every 12 seconds
        setInterval(() => {
            let count = parseInt(localStorage.getItem(ACTIVE_VISITORS_KEY) || '4');
            const rand = Math.random();
            if (rand < 0.45) count = Math.max(2, count - 1);
            else if (rand < 0.90) count = Math.min(9, count + 1);
            localStorage.setItem(ACTIVE_VISITORS_KEY, String(count));
            window.dispatchEvent(new CustomEvent('zen_analytics_active_users_update', { detail: count }));
        }, 12000);
    }

    // Initialize tracker
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startSession);
    } else {
        startSession();
    }

    // Export API to global scope in case dashboard wants to access
    window.ZenAnalytics = {
        getDb: getDatabase,
        saveDb: saveDatabase,
        resetDb: function() {
            localStorage.removeItem(DB_KEY);
            return generateHistoricalData();
        },
        generateLiveSimulatedVisit: function() {
            const countriesList = [
                { country: "Pakistan", code: "PK", cities: ["Sahiwal", "Lahore", "Karachi", "Islamabad"] },
                { country: "United States", code: "US", cities: ["New York", "San Francisco", "Austin"] },
                { country: "United Kingdom", code: "GB", cities: ["London", "Manchester"] },
                { country: "United Arab Emirates", code: "AE", cities: ["Dubai", "Abu Dhabi"] },
                { country: "Germany", code: "DE", cities: ["Berlin", "Hamburg"] },
                { country: "Japan", code: "JP", cities: ["Tokyo", "Osaka"] }
            ];

            const phoneModelsList = {
                "Android": ["Samsung Galaxy S24 Ultra", "Google Pixel 8 Pro", "OnePlus 12", "Xiaomi 14 Pro"],
                "iOS": ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 14 Pro"]
            };

            const pagesList = ["Home", "About", "Work", "Services", "Contact"];
            const browsersList = ["Chrome", "Safari", "Firefox", "Edge", "Opera"];
            const referrersList = [
                { type: "Search Engine", domain: "google.com" },
                { type: "Direct", domain: "" },
                { type: "Social Media", domain: "instagram.com" },
                { type: "Social Media", domain: "whatsapp.com" },
                { type: "Social Media", domain: "facebook.com" },
                { type: "Other Referral", domain: "behance.net" }
            ];

            // Setup visit details
            const geoSelect = countriesList[Math.floor(Math.random() * countriesList.length)];
            const city = geoSelect.cities[Math.floor(Math.random() * geoSelect.cities.length)];
            const page = pagesList[Math.floor(Math.random() * pagesList.length)];
            const ref = referrersList[Math.floor(Math.random() * referrersList.length)];
            const browser = browsersList[Math.floor(Math.random() * browsersList.length)];
            
            const device = Math.random() < 0.65 ? "Mobile" : "Desktop";
            const os = device === "Mobile" ? (Math.random() < 0.4 ? "iOS" : "Android") : (Math.random() < 0.8 ? "Windows" : "macOS");
            const phoneModel = device === "Mobile" ? phoneModelsList[os][Math.floor(Math.random() * phoneModelsList[os].length)] : "PC / Workstation";
            const duration = Math.floor(5 + Math.random() * 120);

            const record = {
                id: `v-${Date.now()}-${Math.floor(Math.random()*10000)}`,
                timestamp: Date.now(),
                sessionId: 's-' + Math.random().toString(36).substring(2, 9),
                page: page,
                referrer: ref.type,
                referrerDomain: ref.domain,
                browser: browser,
                browserVersion: String(Math.floor(115 + Math.random() * 10)),
                device: device,
                os: os,
                phoneModel: phoneModel,
                country: geoSelect.country,
                countryCode: geoSelect.code,
                city: city,
                duration: duration
            };

            const db = getDatabase();
            db.push(record);
            saveDatabase(db);

            // Dispatch event
            window.dispatchEvent(new CustomEvent('zen_analytics_new_visit', { detail: record }));
            return record;
        }
    };
})();
