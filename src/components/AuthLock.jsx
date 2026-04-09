import React, { useEffect, useRef, useState } from 'react';
import { Lock, Unlock, User } from 'lucide-react';

const AuthLock = ({ socket, onAuthenticated, onAnimationComplete }) => {
    const [frameSrc, setFrameSrc] = useState(null);
    const [message, setMessage] = useState("Initializing Security...");
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [selectedCameraIndex, setSelectedCameraIndex] = useState(() => {
        const raw = window.localStorage.getItem('auth_camera_index');
        const parsed = Number.parseInt(raw ?? '', 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    });
    const [isAuthCameraRunning, setIsAuthCameraRunning] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinMessage, setPinMessage] = useState('');
    const [isPinChecking, setIsPinChecking] = useState(false);
    const selectedCameraIndexRef = useRef(selectedCameraIndex);

    useEffect(() => {
        selectedCameraIndexRef.current = selectedCameraIndex;
    }, [selectedCameraIndex]);

    const playUnlockTone = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) {
                return;
            }

            const ctx = new AudioCtx();
            const master = ctx.createGain();
            master.gain.setValueAtTime(0.0001, ctx.currentTime);
            master.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.02);
            master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
            master.connect(ctx.destination);

            const osc1 = ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(660, ctx.currentTime);
            osc1.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.35);
            osc1.connect(master);

            const osc2 = ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(495, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(742, ctx.currentTime + 0.35);
            osc2.connect(master);

            osc1.start(ctx.currentTime);
            osc2.start(ctx.currentTime + 0.01);
            osc1.stop(ctx.currentTime + 0.42);
            osc2.stop(ctx.currentTime + 0.40);

            setTimeout(() => {
                ctx.close().catch(() => { });
            }, 550);
        } catch (e) {
            console.warn('Unlock tone failed:', e);
        }
    };

    useEffect(() => {
        if (!socket) return;

        const refreshCameraList = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const cams = devices.filter((d) => d.kind === 'videoinput');
                const optionCount = Math.max(7, cams.length);
                const normalized = Array.from({ length: optionCount }, (_, idx) => ({
                    index: idx,
                    label: cams[idx]?.label || `Backend Camera Index ${idx}`,
                }));
                setAvailableCameras(normalized);

                if (normalized.length > 0) {
                    const currentIndex = selectedCameraIndexRef.current;
                    const exists = normalized.some((cam) => cam.index === currentIndex);
                    const nextIndex = exists ? currentIndex : normalized[0].index;
                    if (!exists) {
                        setSelectedCameraIndex(nextIndex);
                        selectedCameraIndexRef.current = nextIndex;
                    }
                    socket.emit('set_auth_camera', { camera_index: nextIndex });
                    window.localStorage.setItem('auth_camera_index', String(nextIndex));
                }
            } catch (err) {
                console.warn('Could not enumerate cameras:', err);
            }
        };

        const handleAuthStatus = (data) => {
            console.log("Auth Status:", data);
            if (data.authenticated && !isUnlocking) {
                // Start Unlock Sequence
                setIsUnlocking(true);
                setMessage("Identity Verified. Access Granted.");
                setIsAuthCameraRunning(false);
                playUnlockTone();

                // Wait for animation then notify parent
                setTimeout(() => {
                    onAuthenticated(true);
                    if (onAnimationComplete) {
                        onAnimationComplete();
                    }
                }, 2000); // 2 seconds animation
            } else if (!data.authenticated && !isUnlocking) {
                setMessage("Look at the camera to unlock.");
            }
        };

        const handleAuthFrame = (data) => {
            setFrameSrc(`data:image/jpeg;base64,${data.image}`);
            setIsAuthCameraRunning(true);
        };

        const handleAuthCameraState = (data) => {
            const running = Boolean(data?.running);
            const msg = String(data?.message || '').trim();
            setIsAuthCameraRunning(running);
            if (msg) {
                setMessage(msg);
            }
        };

        const handleBackupPinResult = (data) => {
            const ok = Boolean(data?.ok);
            const msg = String(data?.message || '').trim();
            setIsPinChecking(false);
            setPinMessage(msg || (ok ? 'PIN accepted.' : 'Invalid PIN.'));
            if (ok) {
                setPinInput('');
            }
        };

        socket.on('auth_status', handleAuthStatus);
        socket.on('auth_frame', handleAuthFrame);
        socket.on('backup_pin_result', handleBackupPinResult);
        socket.on('auth_camera_state', handleAuthCameraState);

        refreshCameraList();
        if (navigator.mediaDevices?.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', refreshCameraList);
        }

        return () => {
            socket.off('auth_status', handleAuthStatus);
            socket.off('auth_frame', handleAuthFrame);
            socket.off('backup_pin_result', handleBackupPinResult);
            socket.off('auth_camera_state', handleAuthCameraState);
            if (navigator.mediaDevices?.removeEventListener) {
                navigator.mediaDevices.removeEventListener('devicechange', refreshCameraList);
            }
        };
    }, [socket, onAuthenticated, onAnimationComplete, isUnlocking]);

    const handleCameraChange = (event) => {
        const nextIndex = Number.parseInt(event.target.value, 10);
        if (!Number.isFinite(nextIndex) || nextIndex < 0) {
            return;
        }
        setSelectedCameraIndex(nextIndex);
        window.localStorage.setItem('auth_camera_index', String(nextIndex));
        socket.emit('set_auth_camera', { camera_index: nextIndex });
        setMessage('Switching camera...');
    };

    const toggleAuthCamera = () => {
        if (isAuthCameraRunning) {
            socket.emit('stop_auth_camera');
        } else {
            setMessage('Starting camera...');
            socket.emit('start_auth_camera');
        }
    };

    const submitPinUnlock = () => {
        const pin = String(pinInput || '').trim();
        if (!/^\d{4}$/.test(pin)) {
            setPinMessage('Enter your 4-digit backup PIN.');
            return;
        }
        setIsPinChecking(true);
        setPinMessage('Verifying backup PIN...');
        socket.emit('verify_backup_pin', { pin });
    };

    const themeColor = isUnlocking ? 'text-green-500' : 'text-cyan-500';
    const borderColor = isUnlocking ? 'border-green-500' : 'border-cyan-500';
    const shadowColor = isUnlocking ? 'shadow-[0_0_50px_rgba(34,197,94,0.4)]' : 'shadow-[0_0_50px_rgba(34,211,238,0.2)]';
    const bgGradient = isUnlocking
        ? 'from-green-900/40 via-black to-black'
        : 'from-cyan-900/20 via-black to-black';

    return (

        <div className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center font-mono select-none transition-all duration-[2000ms] ${isUnlocking ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100'}`}
            style={{ transitionDelay: '2000ms' }}> {/* Delay fade out to show success state */}

            {/* Background Grid */}
            <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${bgGradient} pointer-events-none transition-colors duration-[1500ms]`}></div>

            <div className={`relative flex flex-col items-center gap-6 p-10 border ${borderColor}/30 rounded-lg bg-black/80 backdrop-blur-xl ${shadowColor} transition-all duration-[1500ms]`}>
                <div className={`text-3xl font-bold tracking-[0.3em] uppercase drop-shadow-[0_0_10px_currentColor] flex items-center gap-4 ${themeColor} transition-colors duration-1000`}>
                    {isUnlocking ? <Unlock size={32} /> : <Lock size={32} />}
                    {isUnlocking ? "SYSTEM UNLOCKED" : "SYSTEM LOCKED"}
                </div>

                {/* Camera Feed Frame */}
                <div className={`relative w-64 h-64 border-2 ${borderColor}/50 rounded-lg overflow-hidden bg-gray-900 shadow-inner flex items-center justify-center transition-colors duration-500`}>
                    {frameSrc ? (
                        <img
                            src={frameSrc}
                            alt="Auth Camera"
                            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${isUnlocking ? 'opacity-50 grayscale' : 'opacity-100'}`}
                        />
                    ) : (
                        <div className={`animate-pulse ${isUnlocking ? 'text-green-800' : 'text-cyan-800'}`}>
                            <User size={64} />
                        </div>
                    )}

                    {/* Scanning Line Animation - remove on unlock */}
                    {!isUnlocking && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/80 shadow-[0_0_15px_cyan] animate-[scan_2s_ease-in-out_infinite]"></div>
                    )}

                    {/* Success Overlay */}
                    {isUnlocking && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 animate-pulse">
                            <Unlock size={64} className="text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.8)]" />
                        </div>
                    )}
                </div>

                <div className={`text-sm tracking-widest ${isUnlocking ? 'text-green-300' : 'text-cyan-300'} animate-pulse transition-colors duration-500`}>
                    {message}
                </div>

                {!isUnlocking && (
                    <div className="w-full max-w-xs bg-black/40 border border-cyan-900/30 rounded p-2">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/70 mb-1 text-center">Auth Camera</div>
                        <button
                            onClick={toggleAuthCamera}
                            className={`w-full mb-2 px-2 py-1.5 text-[10px] uppercase tracking-widest rounded border ${isAuthCameraRunning
                                ? 'border-red-500/70 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                                : 'border-cyan-500/70 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
                                }`}
                        >
                            {isAuthCameraRunning ? 'Stop Camera' : 'Start Camera'}
                        </button>
                        <select
                            value={selectedCameraIndex}
                            onChange={handleCameraChange}
                            className="w-full bg-black/70 border border-cyan-800 rounded px-2 py-1.5 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                        >
                            {availableCameras.length === 0 ? (
                                <option value={0}>No camera detected</option>
                            ) : (
                                availableCameras.map((cam) => (
                                    <option key={cam.index} value={cam.index}>{`IDX ${cam.index}: ${cam.label}`}</option>
                                ))
                            )}
                        </select>
                    </div>
                )}

                {!isUnlocking && (
                    <div className="w-full max-w-xs pt-2 border-t border-cyan-900/30">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/70 mb-2 text-center">Backup PIN Unlock</div>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        submitPinUnlock();
                                    }
                                }}
                                placeholder="4-digit PIN"
                                className="flex-1 bg-black/70 border border-cyan-800 rounded px-2 py-1.5 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                            />
                            <button
                                onClick={submitPinUnlock}
                                disabled={isPinChecking}
                                className="px-3 py-1.5 text-[10px] uppercase tracking-widest rounded bg-cyan-800/80 hover:bg-cyan-700 text-white disabled:opacity-50"
                            >
                                Unlock
                            </button>
                        </div>
                        {pinMessage && <div className="mt-2 text-[10px] text-cyan-300/80 text-center">{pinMessage}</div>}
                    </div>
                )}
            </div>

            {/* Keyframe for scan animation */}
            <style>{`
                @keyframes scan {
                    0%, 100% { top: 0%; opacity: 0; }
                    50% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
             `}</style>
        </div>
    );
};

export default AuthLock;
