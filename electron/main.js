const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Use hardware acceleration by default for smooth UI.
// Fallback to software rendering only when explicitly requested.
const forceSoftwareRendering = process.env.ADA_FORCE_SOFTWARE_RENDERING === '1';
if (forceSoftwareRendering) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-features', 'Vulkan');
    app.commandLine.appendSwitch('ignore-gpu-blocklist');
    console.warn('[ADA] Running in software rendering mode (ADA_FORCE_SOFTWARE_RENDERING=1).');
}

let mainWindow;
let pythonProcess;
let whatsappWindow;
let whatsappPollTimer;
let isAppShuttingDown = false;
let whatsappConfig = {
    enabled: false,
    notifyEnabled: true,
};
let lastWhatsappUnread = 0;

const WHATSAPP_URL = 'https://web.whatsapp.com';
const WHATSAPP_POLL_MS = 10000;
const WHATSAPP_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const WHATSAPP_EXPECTED_BLOCKED_HOSTS = ['flows.whatsapp.net'];

function emitWhatsappStatus(payload) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('whatsapp-status', payload);
}

function parseUnreadFromTitle(title) {
    const text = String(title || '');
    const match = text.match(/\((\d+)\)/);
    return match ? Number.parseInt(match[1], 10) || 0 : 0;
}

function normalizeWhatsappSnapshot(snapshot) {
    const safe = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const fallbackTitle = whatsappWindow && !whatsappWindow.isDestroyed() ? whatsappWindow.getTitle() : 'WhatsApp';
    const title = String(safe.title || fallbackTitle || 'WhatsApp');
    const unreadCount = Number.isFinite(Number(safe.unreadCount))
        ? Number(safe.unreadCount)
        : parseUnreadFromTitle(title);

    return {
        ok: safe.ok !== false,
        status: String(safe.status || 'login_required'),
        title,
        unreadCount,
        chats: Array.isArray(safe.chats) ? safe.chats : [],
        timestamp: safe.timestamp || Date.now(),
        debug: safe.debug || undefined,
        error: safe.error,
    };
}

function createWhatsappWindow() {
    if (whatsappWindow && !whatsappWindow.isDestroyed()) {
        return whatsappWindow;
    }

    whatsappWindow = new BrowserWindow({
        width: 1200,
        height: 860,
        show: false,
        paintWhenInitiallyHidden: true,
        autoHideMenuBar: true,
        webPreferences: {
            partition: 'persist:whatsapp',
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
    });

    // WhatsApp Web performs strict browser checks. Override Electron UA with a modern Chrome UA.
    whatsappWindow.webContents.setUserAgent(WHATSAPP_USER_AGENT);

    // WhatsApp may probe auxiliary endpoints that intentionally reject embedded loads.
    // Keep logs clean by suppressing this known noisy failure pattern.
    whatsappWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        const url = String(validatedURL || '');
        const isExpectedBlockedRequest =
            errorCode === -20 &&
            WHATSAPP_EXPECTED_BLOCKED_HOSTS.some((host) => url.includes(host));

        if (!isExpectedBlockedRequest) {
            console.warn(`[WhatsApp] did-fail-load (${errorCode}) ${errorDescription} -> ${url}`);
        }
    });

    whatsappWindow.loadURL(WHATSAPP_URL).catch((err) => {
        console.error(`[WhatsApp] Failed to load URL: ${err.message}`);
    });

    whatsappWindow.on('closed', () => {
        whatsappWindow = null;
    });

    return whatsappWindow;
}

async function readWhatsappSnapshot() {
    if (!whatsappWindow || whatsappWindow.isDestroyed()) {
        return {
            ok: false,
            status: 'window_missing',
            unreadCount: 0,
            title: 'WhatsApp',
            chats: [],
            timestamp: Date.now(),
        };
    }

    try {
        const result = await whatsappWindow.webContents.executeJavaScript(`(() => {
            const title = document.title || 'WhatsApp';
            const unreadMatch = title.match(/\\((\\d+)\\)/);
            const unreadCount = unreadMatch ? parseInt(unreadMatch[1], 10) || 0 : 0;

            const sidePane = document.querySelector('#pane-side');
            const chatListFallback = document.querySelector('[data-testid="chat-list"], [data-testid="cell-frame-container"], [role="list"] [role="listitem"]');
            const loginCanvas = document.querySelector('canvas[aria-label]');
            const loginUiFallback = document.querySelector('[data-testid="qrcode"], [data-testid="intro-md-beta-logo"], [data-testid="link-device-phone-number-code-screen"]');
            const hasUnreadSignal = unreadMatch !== null;
            let status = 'connected';
            if (sidePane || chatListFallback || hasUnreadSignal) {
                status = 'connected';
            } else if (loginCanvas || loginUiFallback) {
                status = 'login_required';
            }

            const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
            const stripReadMarkers = (value) => clean(value).replace(/^[✓✔\s]+/, '').trim();
            const looksLikeTime = (value) => /^(?:\\d{1,2}:\\d{2}|gestern|yesterday|heute|today|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)$/i.test(clean(value));
            const candidates = [];
            const seen = new Set();
            const selectors = [
                '#pane-side [role="listitem"]',
                '#pane-side div[data-testid="cell-frame-container"]',
                '#pane-side div[aria-label][tabindex]',
            ];

            for (const selector of selectors) {
                const nodes = Array.from(document.querySelectorAll(selector));
                for (const node of nodes) {
                    const key = node && (node.dataset?.id || node.getAttribute?.('data-id') || node.getAttribute?.('aria-label') || node.innerText || '');
                    const fingerprint = selector + '::' + clean(key).slice(0, 120);
                    if (!seen.has(fingerprint)) {
                        seen.add(fingerprint);
                        candidates.push(node);
                    }
                }
            }

            const rows = candidates.slice(0, 60);
            const parsed = rows.map((row) => {
                const rowTextRaw = row?.innerText || row?.textContent || '';
                const rowText = clean(rowTextRaw);
                if (!rowText) {
                    return null;
                }

                const lines = String(rowTextRaw)
                    .split('\\n')
                    .map((t) => clean(t))
                    .filter(Boolean)
                    .slice(0, 8);

                const nameEl = row.querySelector?.('[data-testid="cell-frame-title"] span[dir="auto"], [data-testid="cell-frame-title"], span[title], h3[dir="auto"]');
                let name = clean(nameEl?.textContent || nameEl?.getAttribute?.('title') || '') || lines[0] || clean(row.getAttribute?.('title') || row.getAttribute?.('aria-label') || '') || 'Unknown';

                const secondaryEl = row.querySelector?.('[data-testid="cell-frame-secondary"], [data-testid="chatlist-secondary"], [aria-label*="time" i]');
                let meta = clean(secondaryEl?.textContent || '') || '';
                if (!meta) {
                    const timeLine = lines.find((l) => looksLikeTime(l));
                    meta = timeLine || '';
                }

                const previewEl = row.querySelector?.('[data-testid="conversation-line-text"] span[dir="auto"], [data-testid="cell-frame-body"] span[dir="auto"], [data-testid="last-msg-status"], span[dir="auto"]');
                let preview = stripReadMarkers(previewEl?.textContent || '');

                if (!preview) {
                    const fallbackLine = lines.find((l) => {
                        const c = clean(l);
                        if (!c) return false;
                        if (c === name) return false;
                        if (meta && c === meta) return false;
                        if (/^\\d{1,3}$/.test(c)) return false;
                        if (looksLikeTime(c)) return false;
                        return true;
                    });
                    preview = stripReadMarkers(fallbackLine || '');
                }

                let unread = 0;

                const unreadBadge = row.querySelector?.('[data-testid="icon-unread-count"], [aria-label*="unread" i], [aria-label*="ungeles" i]');
                if (unreadBadge) {
                    const badgeMatch = clean(unreadBadge.textContent).match(/\\d{1,3}/);
                    if (badgeMatch) unread = parseInt(badgeMatch[0], 10) || 0;
                }

                if (!unread) {
                    const lineLast = lines[lines.length - 1] || '';
                    const trailingMatch = lineLast.match(/\\b(\\d{1,3})\\b$/);
                    if (trailingMatch) unread = parseInt(trailingMatch[1], 10) || 0;
                }

                if (!unread) {
                    const unreadAria = clean(row.getAttribute?.('aria-label') || '');
                    const ariaMatch = unreadAria.match(/(\\d{1,3})\\s*(unread|ungeles)/i);
                    if (ariaMatch) unread = parseInt(ariaMatch[1], 10) || 0;
                }

                return {
                    name,
                    preview,
                    meta,
                    unread,
                };
            }).filter(Boolean);

            const chats = [];
            const chatSeen = new Set();
            for (const item of parsed) {
                const key = clean(item.name) + '|' + clean(item.preview) + '|' + clean(item.meta);
                if (chatSeen.has(key)) continue;
                chatSeen.add(key);
                chats.push(item);
                if (chats.length >= 30) break;
            }

            if (status !== 'connected' && (chats.length > 0 || unreadMatch !== null)) {
                status = 'connected';
            }

            return {
                ok: true,
                status,
                title,
                unreadCount,
                chats,
                debug: {
                    candidateCount: rows.length,
                    parsedCount: parsed.length,
                    chatCount: chats.length,
                },
                timestamp: Date.now(),
            };
        })();`, true);

        return result;
    } catch (err) {
        return {
            ok: false,
            status: 'read_error',
            error: err.message,
            unreadCount: 0,
            title: whatsappWindow.getTitle() || 'WhatsApp',
            chats: [],
            timestamp: Date.now(),
        };
    }
}

async function pollWhatsappStatus() {
    const snapshot = normalizeWhatsappSnapshot(await readWhatsappSnapshot());
    const unreadCount = snapshot.unreadCount;

    if (whatsappConfig.notifyEnabled && unreadCount > lastWhatsappUnread && Notification.isSupported()) {
        const diff = unreadCount - lastWhatsappUnread;
        try {
            const notification = new Notification({
                title: 'WhatsApp',
                body: `${diff} neue Nachricht${diff === 1 ? '' : 'en'} eingegangen.`,
                silent: false,
            });
            notification.show();
        } catch (err) {
            console.error(`[WhatsApp] Notification failed: ${err.message}`);
        }
    }

    lastWhatsappUnread = unreadCount;
    emitWhatsappStatus({
        ...snapshot,
        unreadCount,
    });
}

function startWhatsappWatcher() {
    if (whatsappPollTimer) return;
    createWhatsappWindow();

    pollWhatsappStatus();
    whatsappPollTimer = setInterval(() => {
        pollWhatsappStatus();
    }, WHATSAPP_POLL_MS);
}

function stopWhatsappWatcher() {
    if (whatsappPollTimer) {
        clearInterval(whatsappPollTimer);
        whatsappPollTimer = null;
    }

    lastWhatsappUnread = 0;

    if (whatsappWindow && !whatsappWindow.isDestroyed()) {
        whatsappWindow.close();
        whatsappWindow = null;
    }

    emitWhatsappStatus({
        ok: true,
        status: 'disabled',
        unreadCount: 0,
        title: 'WhatsApp',
        chats: [],
        timestamp: Date.now(),
    });
}

function requestAppShutdown(reason = 'user_request') {
    if (isAppShuttingDown) {
        return;
    }

    isAppShuttingDown = true;
    console.log(`[APP] Shutdown requested (${reason}).`);

    try {
        stopWhatsappWatcher();
    } catch (err) {
        console.warn(`[APP] Failed to stop WhatsApp watcher during shutdown: ${err.message}`);
    }

    app.quit();

    // Safety fallback on Windows if quit hooks are blocked by hanging windows/processes.
    setTimeout(() => {
        if (!app.isReady()) return;
        app.exit(0);
    }, 2000);
}

function requestAppRestart(reason = 'user_restart') {
    if (isAppShuttingDown) {
        return;
    }

    isAppShuttingDown = true;
    console.log(`[APP] Restart requested (${reason}).`);

    try {
        stopWhatsappWatcher();
    } catch (err) {
        console.warn(`[APP] Failed to stop WhatsApp watcher during restart: ${err.message}`);
    }

    app.relaunch();
    app.exit(0);
}

async function readWhatsappSnapshotForToolRequest(options = {}) {
    const showWindow = Boolean(options?.showWindow);
    const maxChatsRaw = Number(options?.maxChats);
    const maxChats = Number.isFinite(maxChatsRaw) ? Math.max(1, Math.min(30, Math.trunc(maxChatsRaw))) : 30;

    const win = createWhatsappWindow();
    if (!win || win.isDestroyed()) {
        return {
            ok: false,
            status: 'window_missing',
            unreadCount: 0,
            title: 'WhatsApp',
            chats: [],
            timestamp: Date.now(),
        };
    }

    if (showWindow) {
        try {
            win.show();
            win.focus();
        } catch (err) {
            console.warn(`[WhatsApp] Failed to show window for tool request: ${err.message}`);
        }
    }

    // Give WhatsApp Web one short UI tick to hydrate visible rows before reading.
    await new Promise((resolve) => setTimeout(resolve, showWindow ? 700 : 180));

    let normalized = normalizeWhatsappSnapshot(await readWhatsappSnapshot());

    // Hidden windows can transiently report login_required before chat pane is hydrated.
    if (normalized.status === 'login_required') {
        await new Promise((resolve) => setTimeout(resolve, 450));
        normalized = normalizeWhatsappSnapshot(await readWhatsappSnapshot());
    }

    return {
        ...normalized,
        chats: normalized.chats.slice(0, maxChats),
    };
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simple IPC/Socket.IO usage
            webviewTag: true,
        },
        backgroundColor: '#000000',
        frame: false, // Frameless for custom UI
        titleBarStyle: 'hidden',
        show: false, // Don't show until ready
    });

    // In dev, load Vite server. In prod, load index.html
    const isDev = process.env.NODE_ENV !== 'production';
    const openDevTools = process.env.ADA_OPEN_DEVTOOLS === '1';

    const loadFrontend = (retries = 3) => {
        const url = isDev ? 'http://localhost:5173' : null;
        const loadPromise = isDev
            ? mainWindow.loadURL(url)
            : mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

        loadPromise
            .then(() => {
                console.log('Frontend loaded successfully!');
                windowWasShown = true;
                mainWindow.show();
                if (isDev && openDevTools) {
                    mainWindow.webContents.openDevTools();
                }
            })
            .catch((err) => {
                console.error(`Failed to load frontend: ${err.message}`);
                if (retries > 0) {
                    console.log(`Retrying in 1 second... (${retries} retries left)`);
                    setTimeout(() => loadFrontend(retries - 1), 1000);
                } else {
                    console.error('Failed to load frontend after all retries. Keeping window open.');
                    windowWasShown = true;
                    mainWindow.show(); // Show anyway so user sees something
                }
            });
    };

    loadFrontend();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error(`[Electron] Main renderer gone: reason=${details?.reason || 'unknown'} code=${details?.exitCode ?? 'n/a'}`);
        if (isAppShuttingDown) return;
        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.reload();
            }
        } catch (err) {
            console.error(`[Electron] Failed to reload renderer: ${err.message}`);
        }
    });
}

function startPythonBackend() {
    const scriptPath = path.join(__dirname, '../backend/server.py');
    console.log(`Starting Python backend: ${scriptPath}`);

    // Assuming 'python' is in PATH. In prod, this would be the executable.
    pythonProcess = spawn('python', [scriptPath], {
        cwd: path.join(__dirname, '../backend'),
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[Python]: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python Error]: ${data}`);
    });
}

app.whenReady().then(() => {
    ipcMain.on('window-minimize', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('window-maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('window-close', () => {
        requestAppShutdown('window_close_button');
    });

    ipcMain.on('whatsapp-config', (_, config) => {
        whatsappConfig = {
            enabled: Boolean(config?.enabled),
            notifyEnabled: config?.notifyEnabled !== false,
        };

        if (whatsappConfig.enabled) {
            startWhatsappWatcher();
        } else {
            stopWhatsappWatcher();
        }
    });

    ipcMain.on('whatsapp-open-login', () => {
        const win = createWhatsappWindow();
        if (!win) return;
        win.show();
        win.focus();
    });

    ipcMain.handle('whatsapp-read-snapshot', async (_event, options) => {
        return readWhatsappSnapshotForToolRequest(options || {});
    });

    ipcMain.handle('app-restart', async () => {
        requestAppRestart('settings_button');
        return { ok: true };
    });

    checkBackendPort(8000).then((isTaken) => {
        if (isTaken) {
            console.log('Port 8000 is taken. Assuming backend is already running manually.');
            waitForBackend().then(createWindow);
        } else {
            startPythonBackend();
            // Give it a moment to start, then wait for health check
            setTimeout(() => {
                waitForBackend().then(createWindow);
            }, 1000);
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    app.on('child-process-gone', (_event, details) => {
        if (details?.type === 'GPU') {
            console.error(`[Electron] GPU process gone: reason=${details.reason || 'unknown'} code=${details.exitCode ?? 'n/a'}`);
        }
    });
});

function checkBackendPort(port) {
    return new Promise((resolve) => {
        const net = require('net');
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port);
    });
}

function waitForBackend() {
    return new Promise((resolve) => {
        const check = () => {
            const http = require('http');
            http.get('http://127.0.0.1:8000/status', (res) => {
                if (res.statusCode === 200) {
                    console.log('Backend is ready!');
                    resolve();
                } else {
                    console.log('Backend not ready, retrying...');
                    setTimeout(check, 1000);
                }
            }).on('error', (err) => {
                console.log('Waiting for backend...');
                setTimeout(check, 1000);
            });
        };
        check();
    });
}

let windowWasShown = false;

app.on('window-all-closed', () => {
    // Only quit if the window was actually shown at least once
    // This prevents quitting during startup if window creation fails
    if (process.platform !== 'darwin' && windowWasShown) {
        app.quit();
    } else if (!windowWasShown) {
        console.log('Window was never shown - keeping app alive to allow retries');
    }
});

app.on('will-quit', () => {
    console.log('App closing... Killing Python backend.');
    isAppShuttingDown = true;
    stopWhatsappWatcher();
    if (pythonProcess) {
        if (process.platform === 'win32') {
            // Windows: Force kill the process tree synchronously
            try {
                const { execSync } = require('child_process');
                execSync(`taskkill /pid ${pythonProcess.pid} /f /t`);
            } catch (e) {
                console.error('Failed to kill python process:', e.message);
            }
        } else {
            // Unix: SIGKILL
            pythonProcess.kill('SIGKILL');
        }
        pythonProcess = null;
    }
});
