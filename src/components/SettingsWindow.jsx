import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';

const TOOLS = [
    { id: 'generate_cad', label: 'Generate CAD' },
    { id: 'run_web_agent', label: 'Web Agent' },
    { id: 'write_file', label: 'Write File' },
    { id: 'read_directory', label: 'Read Directory' },
    { id: 'read_file', label: 'Read File' },
    { id: 'create_project', label: 'Create Project' },
    { id: 'switch_project', label: 'Switch Project' },
    { id: 'list_projects', label: 'List Projects' },
    { id: 'list_smart_devices', label: 'List Devices' },
    { id: 'control_light', label: 'Control Light' },
    { id: 'discover_printers', label: 'Discover Printers' },
    { id: 'print_stl', label: 'Print 3D Model' },
    { id: 'get_print_status', label: 'Get Print Status' },
    { id: 'get_current_datetime', label: 'Get Current DateTime' },
    { id: 'get_weather', label: 'Get Weather' },
    { id: 'get_weather_forecast', label: 'Get Weather Forecast' },
    { id: 'get_weather_full_report', label: 'Get Weather Full Report' },
    { id: 'route_plan', label: 'Route Plan (Free)' },
    { id: 'clear_detail_view', label: 'Clear Detail View' },
    { id: 'system_check', label: 'System Check' },
    { id: 'iterate_cad', label: 'Iterate CAD' },
    { id: 'connect_google_workspace', label: 'Connect Google Workspace' },
    { id: 'list_calendar_events', label: 'List Calendar Events' },
    { id: 'get_calendar_view', label: 'Get Calendar View' },
    { id: 'create_calendar_event', label: 'Create Calendar Event' },
    { id: 'update_calendar_event', label: 'Update Calendar Event' },
    { id: 'delete_calendar_event', label: 'Delete Calendar Event' },
    { id: 'list_calendar_invitations', label: 'List Calendar Invitations' },
    { id: 'respond_calendar_invitation', label: 'Respond Calendar Invitation' },
    { id: 'list_gmail_messages', label: 'List Gmail Messages' },
    { id: 'get_gmail_message_detail', label: 'Get Gmail Message Detail' },
    { id: 'list_gmail_labels', label: 'List Gmail Labels' },
    { id: 'update_gmail_labels', label: 'Update Gmail Labels' },
    { id: 'send_gmail_message', label: 'Send Gmail Message' },
];

const TOOL_GROUPS = {
    Core: [
        'generate_cad',
        'iterate_cad',
        'run_web_agent',
        'clear_detail_view',
    ],
    Files: [
        'write_file',
        'read_directory',
        'read_file',
        'create_project',
        'switch_project',
        'list_projects',
        'create_directory',
    ],
    Home: [
        'list_smart_devices',
        'control_light',
        'discover_printers',
        'print_stl',
        'get_print_status',
    ],
    Productivity: [
        'connect_google_workspace',
        'list_calendar_events',
        'get_calendar_view',
        'create_calendar_event',
        'update_calendar_event',
        'delete_calendar_event',
        'list_calendar_invitations',
        'respond_calendar_invitation',
        'list_gmail_messages',
        'get_gmail_message_detail',
        'list_gmail_labels',
        'update_gmail_labels',
        'send_gmail_message',
    ],
    Utility: [
        'get_current_datetime',
        'get_weather',
        'get_weather_forecast',
        'get_weather_full_report',
        'route_plan',
        'system_check',
    ],
};

const TAB_BUTTON = 'px-3 py-1.5 text-xs rounded-md border transition-colors';
const VOICE_OPTIONS = ['Kore', 'Orus', 'Fenrir', 'Charon', 'Puck', 'Aoede'];

const ToggleRow = ({ label, enabled, onToggle }) => (
    <div className="flex items-center justify-between text-xs bg-gray-900/50 p-2 rounded border border-cyan-900/30">
        <span className="text-cyan-100/80">{label}</span>
        <button
            onClick={onToggle}
            className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${enabled ? 'bg-cyan-500/80' : 'bg-gray-700'}`}
        >
            <div
                className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
            />
        </button>
    </div>
);

const SettingsWindow = ({
    socket,
    micDevices,
    speakerDevices,
    webcamDevices,
    selectedMicId,
    setSelectedMicId,
    selectedSpeakerId,
    setSelectedSpeakerId,
    selectedWebcamId,
    setSelectedWebcamId,
    cursorSensitivity,
    setCursorSensitivity,
    isCameraFlipped,
    setIsCameraFlipped,
    handleFileUpload,
    onClose
}) => {
    const HEADER_HEIGHT = 52;
    const WINDOW_MARGIN = 16;

    const [permissions, setPermissions] = useState({});
    const [faceAuthEnabled, setFaceAuthEnabled] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
    const [apiKeyMessage, setApiKeyMessage] = useState('');
    const [googleConnectMessage, setGoogleConnectMessage] = useState('');
    const [googleConnecting, setGoogleConnecting] = useState(false);
    const [defaultWeatherLocation, setDefaultWeatherLocation] = useState('Berlin,DE');
    const [weatherMessage, setWeatherMessage] = useState('');
    const [voiceName, setVoiceName] = useState('Kore');
    const [voiceMessage, setVoiceMessage] = useState('');
    const [tapoUsername, setTapoUsername] = useState('');
    const [tapoPassword, setTapoPassword] = useState('');
    const [tapoPasswordConfigured, setTapoPasswordConfigured] = useState(false);
    const [tapoMessage, setTapoMessage] = useState('');
    const [activeTab, setActiveTab] = useState('general');
    const [activeToolGroup, setActiveToolGroup] = useState('Core');
    const [windowPos, setWindowPos] = useState({ x: 40, y: 84 });

    const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });

    const groupedTools = useMemo(() => {
        const byId = new Map(TOOLS.map((tool) => [tool.id, tool]));
        const groupEntries = Object.entries(TOOL_GROUPS).map(([group, ids]) => ({
            group,
            items: ids.map((id) => byId.get(id)).filter(Boolean),
        }));
        return groupEntries;
    }, []);

    const clampWindowPosition = (rawX, rawY) => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const estimatedPanelWidth = Math.min(960, width - (WINDOW_MARGIN * 2));
        const estimatedPanelHeight = Math.min(760, height - (WINDOW_MARGIN * 2));
        const maxX = Math.max(WINDOW_MARGIN, width - estimatedPanelWidth - WINDOW_MARGIN);
        const maxY = Math.max(WINDOW_MARGIN, height - estimatedPanelHeight - WINDOW_MARGIN);

        return {
            x: Math.max(WINDOW_MARGIN, Math.min(maxX, rawX)),
            y: Math.max(WINDOW_MARGIN, Math.min(maxY, rawY)),
        };
    };

    useEffect(() => {
        // Request initial permissions
        socket.emit('get_settings');

        // Listen for updates
        const handleSettings = (settings) => {
            console.log("Received settings:", settings);
            if (settings) {
                if (settings.tool_permissions) setPermissions(settings.tool_permissions);
                if (typeof settings.face_auth_enabled !== 'undefined') {
                    setFaceAuthEnabled(settings.face_auth_enabled);
                    localStorage.setItem('face_auth_enabled', settings.face_auth_enabled);
                }
                setApiKeyConfigured(Boolean(settings.gemini_api_key_configured));
                setDefaultWeatherLocation(settings.default_weather_location || 'Berlin,DE');
                setVoiceName(settings.voice_name || 'Kore');
                setTapoUsername(settings.tapo_username || '');
                setTapoPasswordConfigured(Boolean(settings.tapo_password_configured));
            }
        };

        const handleGoogleConnectionResult = (result) => {
            const ok = Boolean(result?.ok);
            const msg = String(result?.message || '').trim() || (ok ? 'Google connected.' : 'Google connect failed.');
            setGoogleConnectMessage(msg);
            setGoogleConnecting(false);
        };

        socket.on('settings', handleSettings);
        socket.on('google_workspace_connection_result', handleGoogleConnectionResult);
        // Also listen for legacy tool_permissions if needed, but 'settings' covers it
        // socket.on('tool_permissions', handlePermissions); 

        return () => {
            socket.off('settings', handleSettings);
            socket.off('google_workspace_connection_result', handleGoogleConnectionResult);
        };
    }, [socket]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragRef.current.active) return;
            const next = clampWindowPosition(e.clientX - dragRef.current.offsetX, e.clientY - dragRef.current.offsetY);
            setWindowPos(next);
        };

        const stopDrag = () => {
            dragRef.current.active = false;
        };

        const handleResize = () => {
            setWindowPos((prev) => clampWindowPosition(prev.x, prev.y));
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const handleDragStart = (e) => {
        dragRef.current.active = true;
        dragRef.current.offsetX = e.clientX - windowPos.x;
        dragRef.current.offsetY = e.clientY - windowPos.y;
    };

    const togglePermission = (toolId) => {
        const currentVal = permissions[toolId] !== false; // Default True
        const nextVal = !currentVal;

        // Update local mostly for responsiveness, but socket roundtrip handles truth
        // setPermissions(prev => ({ ...prev, [toolId]: nextVal }));

        // Send update
        socket.emit('update_settings', { tool_permissions: { [toolId]: nextVal } });
    };

    const toggleFaceAuth = () => {
        const newVal = !faceAuthEnabled;
        setFaceAuthEnabled(newVal); // Optimistic Update
        localStorage.setItem('face_auth_enabled', newVal);
        socket.emit('update_settings', { face_auth_enabled: newVal });
    };

    const toggleCameraFlip = () => {
        const newVal = !isCameraFlipped;
        setIsCameraFlipped(newVal);
        socket.emit('update_settings', { camera_flipped: newVal });
    };

    const saveApiKey = () => {
        const trimmed = apiKeyInput.trim();
        if (!trimmed) {
            setApiKeyMessage('Please enter a valid API key.');
            return;
        }

        socket.emit('update_settings', { gemini_api_key: trimmed });
        setApiKeyInput('');
        setApiKeyConfigured(true);
        setApiKeyMessage('API key saved. Start or restart ADA to use it.');
    };

    const connectGoogleWorkspace = (forceReauth = false) => {
        setGoogleConnecting(true);
        setGoogleConnectMessage(
            forceReauth ? 'Starting Google reconnect with consent screen...' : 'Starting Google connection...'
        );
        socket.emit('connect_google_workspace', { force_reauth: forceReauth });
    };

    const saveWeatherLocation = () => {
        const trimmed = defaultWeatherLocation.trim();
        if (!trimmed) {
            setWeatherMessage('Please enter a valid destination (e.g. Berlin,DE).');
            return;
        }

        socket.emit('update_settings', { default_weather_location: trimmed });
        setWeatherMessage('Destination saved. Used for weather and as default route origin.');
    };

    const saveVoiceName = () => {
        const selected = String(voiceName || '').trim() || 'Kore';
        socket.emit('update_settings', { voice_name: selected });
        setVoiceMessage(`Voice saved: ${selected}. Restart voice session to apply immediately.`);
    };

    const saveTapoAccount = () => {
        const username = String(tapoUsername || '').trim();
        const payload = { tapo_username: username };

        const enteredPassword = String(tapoPassword || '').trim();
        if (enteredPassword) {
            payload.tapo_password = enteredPassword;
        }

        socket.emit('update_settings', payload);
        setTapoPassword('');
        setTapoPasswordConfigured(Boolean(enteredPassword) || tapoPasswordConfigured);
        setTapoMessage('TP-Link/Tapo Account gespeichert. Danach Discover Devices ausfuehren.');
    };

    const renderGeneralTab = () => (
        <div className="space-y-5">
            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Security</h3>
                <ToggleRow
                    label="Face Authentication"
                    enabled={faceAuthEnabled}
                    onToggle={toggleFaceAuth}
                />
            </div>

            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Gemini API Key</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <input
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={apiKeyConfigured ? 'Key saved (enter new key to replace)' : 'Paste Gemini API key'}
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-cyan-500/70">
                            {apiKeyConfigured ? 'Stored key detected' : 'No key stored yet'}
                        </span>
                        <button
                            onClick={saveApiKey}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                        >
                            Save Key
                        </button>
                    </div>
                    {apiKeyMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{apiKeyMessage}</p>}
                </div>
            </div>

            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Google Workspace</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <div className="text-[10px] text-cyan-500/70 mb-2">
                        Start OAuth directly from Settings. No voice prompt required.
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => connectGoogleWorkspace(false)}
                            disabled={googleConnecting}
                            className="flex-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white disabled:opacity-50"
                        >
                            Connect
                        </button>
                        <button
                            onClick={() => connectGoogleWorkspace(true)}
                            disabled={googleConnecting}
                            className="flex-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-900/70 hover:bg-cyan-800 text-white disabled:opacity-50"
                        >
                            Reconnect
                        </button>
                    </div>
                    {googleConnectMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{googleConnectMessage}</p>}
                </div>
            </div>

            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Voice</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <select
                        value={voiceName}
                        onChange={(e) => setVoiceName(e.target.value)}
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    >
                        {VOICE_OPTIONS.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <div className="flex items-center justify-end mt-2">
                        <button
                            onClick={saveVoiceName}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                        >
                            Save Voice
                        </button>
                    </div>
                    {voiceMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{voiceMessage}</p>}
                </div>
            </div>

            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Destination</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <input
                        type="text"
                        value={defaultWeatherLocation}
                        onChange={(e) => setDefaultWeatherLocation(e.target.value)}
                        placeholder="Destination / home base (e.g. Berlin,DE)"
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-cyan-500/70">Used for weather + default route origin</span>
                        <button
                            onClick={saveWeatherLocation}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                        >
                            Save Destination
                        </button>
                    </div>
                    {weatherMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{weatherMessage}</p>}
                </div>
            </div>

            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">TP-Link / Tapo Account</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <div className="text-[10px] text-cyan-500/70 mb-2">
                        Nutzt deinen Tapo Login fuer Discovery und Steuerung von TP-Link Steckdosen/Lampen.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                            type="text"
                            value={tapoUsername}
                            onChange={(e) => setTapoUsername(e.target.value)}
                            placeholder="TP-Link Account E-Mail"
                            className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                        />
                        <input
                            type="password"
                            value={tapoPassword}
                            onChange={(e) => setTapoPassword(e.target.value)}
                            placeholder={tapoPasswordConfigured ? 'Passwort gespeichert (neu eingeben zum Aendern)' : 'TP-Link Passwort'}
                            className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                        />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-cyan-500/70">
                            {tapoPasswordConfigured ? 'Passwort hinterlegt' : 'Kein Passwort hinterlegt'}
                        </span>
                        <button
                            onClick={saveTapoAccount}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                        >
                            Save Tapo Account
                        </button>
                    </div>
                    {tapoMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{tapoMessage}</p>}
                </div>
            </div>

        </div>
    );

    const renderDevicesTab = () => (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Microphone</h3>
                    <select
                        value={selectedMicId}
                        onChange={(e) => setSelectedMicId(e.target.value)}
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    >
                        {micDevices.map((device, i) => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${i + 1}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Speaker</h3>
                    <select
                        value={selectedSpeakerId}
                        onChange={(e) => setSelectedSpeakerId(e.target.value)}
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    >
                        {speakerDevices.map((device, i) => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Speaker ${i + 1}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Webcam</h3>
                    <select
                        value={selectedWebcamId}
                        onChange={(e) => setSelectedWebcamId(e.target.value)}
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    >
                        {webcamDevices.map((device, i) => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${i + 1}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Cursor Sensitivity</h3>
                    <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                        <div className="flex justify-between mb-2 text-xs">
                            <span className="text-cyan-200/80">Hand Tracking Speed</span>
                            <span className="text-cyan-500">{cursorSensitivity}x</span>
                        </div>
                        <input
                            type="range"
                            min="1.0"
                            max="5.0"
                            step="0.1"
                            value={cursorSensitivity}
                            onChange={(e) => setCursorSensitivity(parseFloat(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer h-1 bg-gray-800 rounded-lg appearance-none"
                        />
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Gesture Control</h3>
                <ToggleRow
                    label="Flip Camera Horizontal"
                    enabled={isCameraFlipped}
                    onToggle={toggleCameraFlip}
                />
            </div>

            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Memory Data</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <label className="text-[10px] text-cyan-500/60 uppercase">Upload Memory Text</label>
                    <input
                        type="file"
                        accept=".txt"
                        onChange={handleFileUpload}
                        className="mt-2 w-full text-xs text-cyan-100 bg-gray-900 border border-cyan-800 rounded p-2 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-cyan-900 file:text-cyan-400 hover:file:bg-cyan-800 cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );

    const renderToolsTab = () => {
        const selectedGroup = groupedTools.find((g) => g.group === activeToolGroup) || groupedTools[0];

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {groupedTools.map((group) => {
                        const active = activeToolGroup === group.group;
                        return (
                            <button
                                key={group.group}
                                onClick={() => setActiveToolGroup(group.group)}
                                className={`${TAB_BUTTON} ${active ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                            >
                                {group.group}
                            </button>
                        );
                    })}
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-hide pr-1">
                    {(selectedGroup?.items || []).map((tool) => {
                        const isRequired = permissions[tool.id] !== false;
                        return (
                            <ToggleRow
                                key={tool.id}
                                label={tool.label}
                                enabled={isRequired}
                                onToggle={() => togglePermission(tool.id)}
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div
            className="fixed bg-black/92 border border-cyan-500/50 rounded-lg z-50 backdrop-blur-xl shadow-[0_0_35px_rgba(6,182,212,0.25)] overflow-hidden"
            style={{
                left: windowPos.x,
                top: windowPos.y,
                width: 'min(960px, calc(100vw - 32px))',
                height: 'min(760px, calc(100vh - 32px))',
            }}
        >
            <div
                className="h-[52px] px-4 border-b border-cyan-900/50 flex items-center justify-between bg-black/65 cursor-move"
                onMouseDown={handleDragStart}
            >
                <div>
                    <h2 className="text-cyan-300 font-bold text-sm uppercase tracking-wider">Settings</h2>
                    <p className="text-[10px] text-cyan-600/80 mt-0.5">Drag this bar to move the window</p>
                </div>
                <button onClick={onClose} className="text-cyan-600 hover:text-cyan-300 transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="h-[44px] px-4 border-b border-cyan-900/40 flex items-center gap-2 bg-black/35">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`${TAB_BUTTON} ${activeTab === 'general' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('devices')}
                    className={`${TAB_BUTTON} ${activeTab === 'devices' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                >
                    Devices
                </button>
                <button
                    onClick={() => setActiveTab('tools')}
                    className={`${TAB_BUTTON} ${activeTab === 'tools' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                >
                    Tool Permissions
                </button>
            </div>

            <div
                className="px-4 py-4 overflow-y-auto scrollbar-hide"
                style={{ height: `calc(100% - ${HEADER_HEIGHT + 44}px)` }}
            >
                {activeTab === 'general' && renderGeneralTab()}
                {activeTab === 'devices' && renderDevicesTab()}
                {activeTab === 'tools' && renderToolsTab()}
            </div>
        </div>
    );
};

export default SettingsWindow;
