import React, { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_TEMPLATE = [
    '   ___    ____    ___        __      ____  ',
    '  / _ |  / __/   / _ | ___  / /____ / __/  ',
    ' / __ | _\\ \\   / __ |/ _ \\/ __/ -_)\\ \\    ',
    '/_/ |_|/___/  /_/ |_|\\___/\\__/\\__/___/   ',
    '',
    '[BOOT] Kernel profile: ADA_V2',
    '[BOOT] Initializing subsystems...',
];

const READY_LABELS = [
    ['socketConnected', 'Socket Link'],
    ['settingsLoaded', 'Settings'],
    ['devicesLoaded', 'Device Graph'],
    ['backendReady', 'Model Session'],
    ['projectLoaded', 'Project Context'],
    ['uiReady', 'UI Sync'],
];

const safePlay = (path, volume = 0.22) => {
    try {
        const audio = new Audio(path);
        audio.volume = volume;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => { });
        }
    } catch {
        // Optional audio hook: silently ignore when files are missing or blocked.
    }
};

function BootSplash({ ready, bootState, lines }) {
    const [templateLines, setTemplateLines] = useState(DEFAULT_TEMPLATE);
    const [revealedCount, setRevealedCount] = useState(0);
    const [cursorVisible, setCursorVisible] = useState(true);
    const completionSoundPlayedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        fetch('/boot/console-template.txt')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('template_not_found');
                }
                return response.text();
            })
            .then((text) => {
                if (cancelled) return;
                const parsed = text
                    .split(/\r?\n/)
                    .map((line) => line.replace(/\t/g, '    '));
                if (parsed.length > 0) {
                    setTemplateLines(parsed);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTemplateLines(DEFAULT_TEMPLATE);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const fullLogLines = useMemo(() => {
        const signalLine = ready
            ? '[BOOT] All systems loaded.'
            : '[BOOT] Waiting for all mandatory systems...';
        return [...templateLines, ...lines, signalLine];
    }, [templateLines, lines, ready]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCursorVisible(prev => !prev);
        }, 420);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setRevealedCount((prev) => {
                const next = Math.min(prev + 1, fullLogLines.length);
                if (next > prev && next % 2 === 0) {
                    safePlay('/sounds/boot-key.wav', 0.12);
                }
                return next;
            });
        }, ready ? 28 : 48);

        return () => clearInterval(interval);
    }, [fullLogLines.length, ready]);

    useEffect(() => {
        if (!ready || completionSoundPlayedRef.current) {
            return;
        }
        completionSoundPlayedRef.current = true;
        safePlay('/sounds/boot-complete.wav', 0.24);
    }, [ready]);

    const progress = useMemo(() => {
        const keys = ['socketConnected', 'settingsLoaded', 'devicesLoaded', 'backendReady', 'projectLoaded'];
        const done = keys.filter((k) => bootState?.[k]).length;
        return Math.round((done / keys.length) * 100);
    }, [bootState]);

    const visibleLines = fullLogLines.slice(0, Math.max(1, revealedCount));

    return (
        <div className="boot-overlay fixed inset-0 z-[220] flex items-center justify-center p-4">
            <div className="boot-grid absolute inset-0" />
            <div className="boot-shell relative w-full max-w-5xl rounded-2xl border border-cyan-500/40 bg-black/70 backdrop-blur-xl shadow-[0_0_70px_rgba(6,182,212,0.18)] overflow-hidden">
                <div className="boot-header px-4 py-2 border-b border-cyan-700/50 flex items-center justify-between text-xs tracking-wider text-cyan-200/90">
                    <span>A.D.A BOOT SEQUENCE</span>
                    <span>{progress}%</span>
                </div>

                <div className="relative">
                    <div className="boot-scanline pointer-events-none absolute inset-0" />
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-0">
                        <pre className="boot-console m-0 px-4 py-4 text-[12px] leading-5 md:text-[13px] md:leading-6 overflow-auto max-h-[58vh] md:max-h-[64vh]">
                            {visibleLines.join('\n')}
                            {cursorVisible ? '\n> _' : '\n> '}
                        </pre>

                        <div className="border-t md:border-t-0 md:border-l border-cyan-800/60 px-4 py-4 bg-cyan-950/10">
                            <div className="text-[11px] tracking-[0.2em] text-cyan-300/80 mb-3">SYSTEM MATRIX</div>
                            <div className="space-y-2">
                                {READY_LABELS.map(([key, label]) => {
                                    const ok = Boolean(bootState?.[key]);
                                    return (
                                        <div key={key} className="flex items-center justify-between text-xs">
                                            <span className="text-cyan-100/80">{label}</span>
                                            <span className={ok ? 'text-emerald-300' : 'text-amber-300'}>
                                                {ok ? 'ONLINE' : 'WAIT'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-4 h-2 rounded-full bg-cyan-950 border border-cyan-800 overflow-hidden">
                                <div
                                    className="h-full boot-progress"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            <div className="mt-4 text-[11px] text-cyan-200/80 leading-5">
                                {ready
                                    ? 'All systems loaded. Ready to start.'
                                    : 'Booting backend services, loading settings and synchronizing devices.'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BootSplash;
