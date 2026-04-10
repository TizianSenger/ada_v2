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
    ['smartDevicesLoaded', 'Smart Devices'],
    ['uiReady', 'UI Sync'],
];

const splitTemplateSections = (sourceLines) => {
    const lines = Array.isArray(sourceLines) ? sourceLines : [];
    const firstBlank = lines.findIndex((line) => String(line || '').trim() === '');

    if (firstBlank > 0) {
        return {
            asciiLines: lines.slice(0, firstBlank),
            bodyLines: lines.slice(firstBlank + 1),
        };
    }

    return {
        asciiLines: DEFAULT_TEMPLATE.slice(0, 4),
        bodyLines: lines,
    };
};

const parseThemeFromLines = (sourceLines) => {
    const themeLine = sourceLines.find((line) => line.toLowerCase().startsWith('[boot] theme:'));
    if (!themeLine) return 'classic';

    const raw = themeLine.split(':').slice(1).join(':').trim().toLowerCase();
    if (raw.includes('cinematic') || raw.includes('crt') || raw.includes('film')) {
        return 'cinematic';
    }
    return 'classic';
};

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
    const [asciiHeaderLines, setAsciiHeaderLines] = useState([]);
    const [revealedCount, setRevealedCount] = useState(0);
    const [cursorVisible, setCursorVisible] = useState(true);
    const [glitchPulse, setGlitchPulse] = useState(false);
    const completionSoundPlayedRef = useRef(false);
    const consoleRef = useRef(null);

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

    useEffect(() => {
        let cancelled = false;

        fetch('/boot/ascii-header.txt')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('ascii_header_not_found');
                }
                return response.text();
            })
            .then((text) => {
                if (cancelled) return;
                const parsed = text
                    .split(/\r?\n/)
                    .map((line) => line.replace(/\t/g, '    '))
                    .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ''));
                setAsciiHeaderLines(parsed);
            })
            .catch(() => {
                if (!cancelled) {
                    setAsciiHeaderLines([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const { asciiLines, bodyLines } = useMemo(
        () => splitTemplateSections(templateLines),
        [templateLines]
    );

    const fullLogLines = useMemo(() => {
        const signalLine = ready
            ? '[BOOT] All systems loaded.'
            : '[BOOT] Waiting for all mandatory systems...';
        return [...bodyLines, ...lines, signalLine];
    }, [bodyLines, lines, ready]);

    const splashTheme = useMemo(() => parseThemeFromLines(templateLines), [templateLines]);
    const isCinematic = splashTheme === 'cinematic';

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
        if (!isCinematic) {
            return undefined;
        }

        const interval = setInterval(() => {
            const trigger = Math.random() > 0.75;
            setGlitchPulse(trigger);
            if (trigger) {
                setTimeout(() => setGlitchPulse(false), 80);
            }
        }, 650);

        return () => clearInterval(interval);
    }, [isCinematic]);

    useEffect(() => {
        if (!ready || completionSoundPlayedRef.current) {
            return;
        }
        completionSoundPlayedRef.current = true;
        safePlay('/sounds/boot-complete.wav', 0.24);
    }, [ready]);

    const progress = useMemo(() => {
        const keys = ['socketConnected', 'settingsLoaded', 'devicesLoaded', 'backendReady', 'projectLoaded', 'smartDevicesLoaded'];
        const done = keys.filter((k) => bootState?.[k]).length;
        return Math.round((done / keys.length) * 100);
    }, [bootState]);

    const visibleLines = fullLogLines.slice(0, Math.max(1, revealedCount));
    const activeAsciiLines = asciiHeaderLines.length > 0 ? asciiHeaderLines : asciiLines;

    useEffect(() => {
        const node = consoleRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight;
    }, [visibleLines.length, cursorVisible]);

    return (
        <div className={`boot-overlay fixed inset-0 z-[10000] flex items-center justify-center p-4 ${isCinematic ? 'boot-overlay-cinematic' : 'boot-overlay-classic'}`}>
            <div className={`boot-grid absolute inset-0 ${isCinematic ? 'boot-grid-cinematic' : ''}`} />
            <div className={`boot-shell relative w-full max-w-5xl rounded-2xl border overflow-hidden ${isCinematic ? 'boot-shell-cinematic border-rose-400/25 bg-black/75 shadow-[0_0_90px_rgba(244,63,94,0.2)]' : 'border-cyan-500/40 bg-black/70 backdrop-blur-xl shadow-[0_0_70px_rgba(6,182,212,0.18)]'} ${glitchPulse ? 'boot-glitch-pulse' : ''}`}>
                <div className={`boot-header px-4 py-2 border-b flex items-center justify-between text-xs tracking-wider ${isCinematic ? 'border-rose-700/40 text-rose-100/85' : 'border-cyan-700/50 text-cyan-200/90'}`}>
                    <span>A.D.A BOOT SEQUENCE</span>
                    <span>{progress}%</span>
                </div>

                <div className="relative">
                    {isCinematic && (
                        <>
                            <div className="boot-vignette pointer-events-none absolute inset-0" />
                            <div className="boot-crt-lines pointer-events-none absolute inset-0" />
                            <div className="boot-rgb-shift pointer-events-none absolute inset-0" />
                        </>
                    )}
                    <div className="boot-scanline pointer-events-none absolute inset-0" />
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-0">
                        <div className="flex flex-col max-h-[58vh] md:max-h-[64vh]">
                            <pre className={`boot-console boot-ascii-header m-0 px-4 py-3 text-[12px] leading-5 md:text-[13px] md:leading-6 ${isCinematic ? 'boot-console-cinematic' : ''}`}>
                                {activeAsciiLines.join('\n')}
                            </pre>
                            <div className={`border-t ${isCinematic ? 'border-rose-900/55' : 'border-cyan-800/60'}`} />
                            <div className={`boot-ascii-fade ${isCinematic ? 'boot-ascii-fade-cinematic' : ''}`} />
                            <pre
                                ref={consoleRef}
                                className={`boot-console boot-console-scroll scrollbar-hide m-0 px-4 py-3 text-[12px] leading-5 md:text-[13px] md:leading-6 overflow-y-auto flex-1 ${isCinematic ? 'boot-console-cinematic' : ''}`}
                            >
                                {visibleLines.join('\n')}
                                {cursorVisible ? '\n> _' : '\n> '}
                            </pre>
                        </div>

                        <div className={`border-t md:border-t-0 md:border-l px-4 py-4 ${isCinematic ? 'border-rose-900/55 bg-rose-950/15' : 'border-cyan-800/60 bg-cyan-950/10'}`}>
                            <div className={`text-[11px] tracking-[0.2em] mb-3 ${isCinematic ? 'text-rose-200/80' : 'text-cyan-300/80'}`}>SYSTEM MATRIX</div>
                            <div className="space-y-2">
                                {READY_LABELS.map(([key, label]) => {
                                    const ok = Boolean(bootState?.[key]);
                                    return (
                                        <div key={key} className="flex items-center justify-between text-xs">
                                            <span className={isCinematic ? 'text-rose-100/75' : 'text-cyan-100/80'}>{label}</span>
                                            <span className={ok ? 'text-emerald-300' : (isCinematic ? 'text-rose-300' : 'text-amber-300')}>
                                                {ok ? 'ONLINE' : 'WAIT'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={`mt-4 h-2 rounded-full border overflow-hidden ${isCinematic ? 'bg-rose-950 border-rose-900' : 'bg-cyan-950 border-cyan-800'}`}>
                                <div
                                    className={`h-full boot-progress ${isCinematic ? 'boot-progress-cinematic' : ''}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            <div className={`mt-4 text-[11px] leading-5 ${isCinematic ? 'text-rose-100/80' : 'text-cyan-200/80'}`}>
                                {ready
                                    ? 'All systems loaded. Ready to start.'
                                    : 'Booting backend services, loading settings and synchronizing devices.'}
                            </div>

                            {isCinematic && (
                                <div className="mt-3 text-[10px] tracking-widest text-rose-300/70 boot-cinematic-tag">
                                    CINEMATIC CRT MODE
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BootSplash;
