import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';

const ipcRenderer =
    typeof window !== 'undefined' && typeof window.require === 'function'
        ? window.require('electron')?.ipcRenderer
        : null;

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
    { id: 'search_stock_symbol', label: 'Search Stock Symbol' },
    { id: 'get_stock_quote', label: 'Get Stock Quote' },
    { id: 'get_stock_news', label: 'Get Stock News' },
    { id: 'search_spotify', label: 'Search Spotify' },
    { id: 'spotify_get_auth_url', label: 'Spotify Get Auth URL' },
    { id: 'spotify_connect_account', label: 'Spotify Connect Account' },
    { id: 'spotify_get_playback_status', label: 'Spotify Get Playback Status' },
    { id: 'spotify_list_playlists', label: 'Spotify List Playlists' },
    { id: 'spotify_get_favorites', label: 'Spotify Get Favorites' },
    { id: 'spotify_get_daylist', label: 'Spotify Get Daylist' },
    { id: 'spotify_add_to_playlist', label: 'Spotify Add To Playlist' },
    { id: 'spotify_add_to_favorites', label: 'Spotify Add To Favorites' },
    { id: 'spotify_play', label: 'Spotify Play' },
    { id: 'spotify_pause', label: 'Spotify Pause' },
    { id: 'spotify_resume', label: 'Spotify Resume' },
    { id: 'spotify_next', label: 'Spotify Next' },
    { id: 'spotify_previous', label: 'Spotify Previous' },
    { id: 'spotify_set_playback_mode', label: 'Spotify Set Playback Mode' },
    { id: 'route_plan', label: 'Route Plan (Free)' },
    { id: 'get_whatsapp_unread', label: 'Get WhatsApp Unread' },
    { id: 'show_whatsapp_detail_view', label: 'Show WhatsApp Detail View' },
    { id: 'system_check', label: 'System Check' },
    { id: 'search_memory', label: 'Search Memory' },
    { id: 'save_to_memory', label: 'Save to Memory' },
    { id: 'memory_status', label: 'Memory Status' },
    { id: 'show_memory_quality_view', label: 'Show Memory Quality View' },
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
    WhatsApp: [
        'get_whatsapp_unread',
        'show_whatsapp_detail_view',
    ],
    Utility: [
        'get_current_datetime',
        'get_weather',
        'get_weather_forecast',
        'get_weather_full_report',
        'route_plan',
        'system_check',
        'search_memory',
        'save_to_memory',
        'memory_status',
        'show_memory_quality_view',
    ],
    Finance: [
        'search_stock_symbol',
        'get_stock_quote',
        'get_stock_news',
    ],
    Music: [
        'search_spotify',
        'spotify_get_auth_url',
        'spotify_connect_account',
        'spotify_get_playback_status',
        'spotify_list_playlists',
        'spotify_get_favorites',
        'spotify_get_daylist',
        'spotify_add_to_playlist',
        'spotify_add_to_favorites',
        'spotify_play',
        'spotify_pause',
        'spotify_resume',
        'spotify_next',
        'spotify_previous',
        'spotify_set_playback_mode',
    ],
};

const PRINTER_TOOL_IDS = ['discover_printers', 'print_stl', 'get_print_status'];
const SMART_HOME_TOOL_IDS = ['list_smart_devices', 'control_light'];
const WHATSAPP_TOOL_IDS = ['get_whatsapp_unread', 'show_whatsapp_detail_view'];
const WEATHER_TOOL_IDS = ['get_weather', 'get_weather_forecast', 'get_weather_full_report'];
const STOCK_TOOL_IDS = ['search_stock_symbol', 'get_stock_quote', 'get_stock_news'];
const SPOTIFY_TOOL_IDS = [
    'search_spotify',
    'spotify_get_auth_url',
    'spotify_connect_account',
    'spotify_get_playback_status',
    'spotify_list_playlists',
    'spotify_get_favorites',
    'spotify_get_daylist',
    'spotify_add_to_playlist',
    'spotify_add_to_favorites',
    'spotify_play',
    'spotify_pause',
    'spotify_resume',
    'spotify_next',
    'spotify_previous',
    'spotify_set_playback_mode',
];
const ROUTE_TOOL_IDS = ['route_plan'];
const FILE_PROJECT_TOOL_IDS = [
    'write_file',
    'read_directory',
    'read_file',
    'create_project',
    'switch_project',
    'list_projects',
    'create_directory',
];
const MEMORY_TOOL_IDS = ['search_memory', 'save_to_memory', 'memory_status', 'show_memory_quality_view'];
const DATETIME_TOOL_IDS = ['get_current_datetime'];
const CAD_TOOL_IDS = ['generate_cad', 'iterate_cad'];
const WEB_AGENT_TOOL_IDS = ['run_web_agent', 'show_last_web_result'];
const CALENDAR_MAIL_TOOL_IDS = [
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
];

const TAB_BUTTON = 'px-3 py-1.5 text-xs rounded-md border transition-colors';
const VOICE_OPTIONS = ['Kore', 'Orus', 'Fenrir', 'Charon', 'Puck', 'Aoede'];
const SPLASH_THEME_OPTIONS = [
    {
        id: 'CYAN_TERMINAL',
        label: 'Classic Cyan Terminal',
        description: 'Original cyan console style with clean scanline motion.',
    },
    {
        id: 'CINEMATIC_CRT',
        label: 'Cinematic CRT',
        description: 'Film-like boot look with glitch pulses, CRT lines, and vignette.',
    },
];

const PERSONALITY_PRESET_OPTIONS = [
    {
        id: 'CLASSIC_CURRENT',
        label: 'Current Personality (Classic)',
        description: 'Warm, witty, friendly, and natural - this matches your current default behavior.',
    },
    {
        id: 'FOCUSED_PRO',
        label: 'Focused Professional',
        description: 'Concise, structured, and efficiency-first.',
    },
    {
        id: 'CREATIVE_COACH',
        label: 'Creative Coach',
        description: 'Encouraging, idea-rich, and energetic.',
    },
    {
        id: 'CALM_ANALYST',
        label: 'Calm Analyst',
        description: 'Measured, thoughtful, and precision-oriented.',
    },
    {
        id: 'EXTREME_EMOTIONAL_INTELLIGENCE',
        label: 'Extreme Emotional Intelligence',
        description: 'Ultra-empathic, emotionally attuned, patient, and deeply human-aware communication style.',
    },
    {
        id: 'CUSTOM_MIX',
        label: 'Custom Mix (Sliders)',
        description: 'Build your own personality profile with trait sliders.',
    },
];

const PERSONALITY_DEFAULT_CUSTOM = {
    warmth: 65,
    emotionality: 60,
    empathy: 70,
    humor: 40,
    directness: 70,
    creativity: 55,
    formality: 45,
    assertiveness: 55,
    patience: 65,
    curiosity: 60,
};

const PERSONALITY_PRESET_DEFAULTS = {
    CLASSIC_CURRENT: {
        ...PERSONALITY_DEFAULT_CUSTOM,
    },
    FOCUSED_PRO: {
        warmth: 45,
        emotionality: 35,
        empathy: 50,
        humor: 20,
        directness: 88,
        creativity: 45,
        formality: 68,
        assertiveness: 74,
        patience: 52,
        curiosity: 48,
    },
    CREATIVE_COACH: {
        warmth: 80,
        emotionality: 70,
        empathy: 72,
        humor: 65,
        directness: 58,
        creativity: 90,
        formality: 28,
        assertiveness: 60,
        patience: 62,
        curiosity: 92,
    },
    CALM_ANALYST: {
        warmth: 58,
        emotionality: 35,
        empathy: 60,
        humor: 15,
        directness: 68,
        creativity: 50,
        formality: 72,
        assertiveness: 52,
        patience: 84,
        curiosity: 70,
    },
    EXTREME_EMOTIONAL_INTELLIGENCE: {
        warmth: 94,
        emotionality: 96,
        empathy: 98,
        humor: 46,
        directness: 42,
        creativity: 72,
        formality: 36,
        assertiveness: 40,
        patience: 95,
        curiosity: 74,
    },
    CUSTOM_MIX: {
        ...PERSONALITY_DEFAULT_CUSTOM,
    },
};

const PERSONALITY_TRAIT_DEFS = [
    { key: 'warmth', label: 'Warmth' },
    { key: 'emotionality', label: 'Emotionality' },
    { key: 'empathy', label: 'Empathy' },
    { key: 'humor', label: 'Humor' },
    { key: 'directness', label: 'Directness' },
    { key: 'creativity', label: 'Creativity' },
    { key: 'formality', label: 'Formality' },
    { key: 'assertiveness', label: 'Assertiveness' },
    { key: 'patience', label: 'Patience' },
    { key: 'curiosity', label: 'Curiosity' },
];

const levelPhrase = (value, low, mid, high) => {
    if (value <= 33) return low;
    if (value <= 66) return mid;
    return high;
};

const buildPersonalityPreviewText = (preset, custom) => {
    const selectedPreset = String(preset || '').trim().toUpperCase();
    if (selectedPreset === 'CLASSIC_CURRENT') {
        return 'Warm, witty, and friendly style with natural flow and balanced empathy.';
    }
    if (selectedPreset === 'FOCUSED_PRO') {
        return 'Professional and concise style focused on fast, structured, actionable answers.';
    }
    if (selectedPreset === 'CREATIVE_COACH') {
        return 'Encouraging and idea-driven style with playful energy and practical momentum.';
    }
    if (selectedPreset === 'CALM_ANALYST') {
        return 'Calm and analytical style with careful reasoning, trade-offs, and precision.';
    }
    if (selectedPreset === 'EXTREME_EMOTIONAL_INTELLIGENCE') {
        return 'Highly empathic and emotionally intelligent style focused on feelings, validation, patience, and supportive guidance.';
    }

    const warmth = Number.parseInt(custom?.warmth, 10) || 0;
    const emotionality = Number.parseInt(custom?.emotionality, 10) || 0;
    const empathy = Number.parseInt(custom?.empathy, 10) || 0;
    const humor = Number.parseInt(custom?.humor, 10) || 0;
    const directness = Number.parseInt(custom?.directness, 10) || 0;
    const creativity = Number.parseInt(custom?.creativity, 10) || 0;
    const formality = Number.parseInt(custom?.formality, 10) || 0;
    const assertiveness = Number.parseInt(custom?.assertiveness, 10) || 0;
    const patience = Number.parseInt(custom?.patience, 10) || 0;
    const curiosity = Number.parseInt(custom?.curiosity, 10) || 0;

    return [
        levelPhrase(warmth, 'neutral tone', 'friendly tone', 'very warm tone'),
        levelPhrase(emotionality, 'emotionally reserved', 'emotion-aware', 'emotion-forward and expressive'),
        levelPhrase(empathy, 'task-first with limited empathy', 'balanced empathy', 'deeply empathic and validating'),
        levelPhrase(humor, 'minimal humor', 'light humor', 'playful humor'),
        levelPhrase(directness, 'explorative guidance', 'balanced directness', 'high directness'),
        levelPhrase(creativity, 'conventional solutions', 'mixed creativity', 'highly creative options'),
        levelPhrase(formality, 'casual language', 'semi-formal language', 'formal language'),
        levelPhrase(assertiveness, 'soft recommendations', 'confident recommendations', 'strong decisive recommendations'),
        levelPhrase(patience, 'fast-paced responses', 'balanced pacing', 'patient and stepwise pacing'),
        levelPhrase(curiosity, 'only answer what is asked', 'occasional clarifying questions', 'proactive exploration and clarifying questions'),
    ].join(' | ');
};

const sanitizePersonalityCustom = (raw) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const result = {};
    PERSONALITY_TRAIT_DEFS.forEach((trait) => {
        const parsed = Number.parseInt(source[trait.key], 10);
        const fallback = PERSONALITY_DEFAULT_CUSTOM[trait.key] ?? 50;
        result[trait.key] = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
    });
    return result;
};

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

    const [toolEnabled, setToolEnabled] = useState({});
    const [permissions, setPermissions] = useState({});
    const [faceAuthEnabled, setFaceAuthEnabled] = useState(false);
    const [showLockButton, setShowLockButton] = useState(true);
    const [powerOffPinRequired, setPowerOffPinRequired] = useState(true);
    const [whatsappMonitorEnabled, setWhatsappMonitorEnabled] = useState(false);
    const [whatsappNotifyEnabled, setWhatsappNotifyEnabled] = useState(true);
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [longTermMemoryEnabled, setLongTermMemoryEnabled] = useState(true);
    const [memoryLocked, setMemoryLocked] = useState(false);
    const [clearMemoryBusy, setClearMemoryBusy] = useState(false);
    const [clearMemoryMessage, setClearMemoryMessage] = useState('');
    const [showClearMemoryConfirm, setShowClearMemoryConfirm] = useState(false);
    const [memoryEntryCount, setMemoryEntryCount] = useState(null);
    const [memoryQualityLoading, setMemoryQualityLoading] = useState(false);
    const [memoryQualityMessage, setMemoryQualityMessage] = useState('');
    const [memoryQualityReport, setMemoryQualityReport] = useState(null);
    const [faceSetupPin, setFaceSetupPin] = useState('');
    const [faceSetupPinConfirm, setFaceSetupPinConfirm] = useState('');
    const [faceSetupBusy, setFaceSetupBusy] = useState(false);
    const [faceSetupMessage, setFaceSetupMessage] = useState('');
    const [isFaceSetupPopupOpen, setIsFaceSetupPopupOpen] = useState(false);
    const [faceCaptureCountdown, setFaceCaptureCountdown] = useState(5);
    const [backupPinConfigured, setBackupPinConfigured] = useState(false);
    const [faceReferenceConfigured, setFaceReferenceConfigured] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
    const [apiKeyMessage, setApiKeyMessage] = useState('');
    const [finnhubApiKeyInput, setFinnhubApiKeyInput] = useState('');
    const [finnhubApiKeyConfigured, setFinnhubApiKeyConfigured] = useState(false);
    const [finnhubApiKeyMessage, setFinnhubApiKeyMessage] = useState('');
    const [spotifyClientId, setSpotifyClientId] = useState('');
    const [spotifyClientSecret, setSpotifyClientSecret] = useState('');
    const [spotifyClientSecretConfigured, setSpotifyClientSecretConfigured] = useState(false);
    const [spotifyRedirectUri, setSpotifyRedirectUri] = useState('http://127.0.0.1:8000/spotify/callback');
    const [spotifyScopes, setSpotifyScopes] = useState('');
    const [spotifyAuthCodeInput, setSpotifyAuthCodeInput] = useState('');
    const [spotifyConnectBusy, setSpotifyConnectBusy] = useState(false);
    const [spotifyStatusMessage, setSpotifyStatusMessage] = useState('');
    const [spotifyConnected, setSpotifyConnected] = useState(false);
    const [spotifyConnectedUser, setSpotifyConnectedUser] = useState({});
    const [spotifyTokenExpiresAt, setSpotifyTokenExpiresAt] = useState(0);
    const [spotifyRefreshTokenConfigured, setSpotifyRefreshTokenConfigured] = useState(false);
    const [spotifyAccessTokenConfigured, setSpotifyAccessTokenConfigured] = useState(false);
    const [spotifyLastDeviceId, setSpotifyLastDeviceId] = useState('');
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
    const [bootSplashTheme, setBootSplashTheme] = useState('CINEMATIC_CRT');
    const [bootSplashThemeBusy, setBootSplashThemeBusy] = useState(false);
    const [bootSplashThemeMessage, setBootSplashThemeMessage] = useState('');
    const [personaliseSubTab, setPersonaliseSubTab] = useState('identity');
    const [aiDisplayName, setAiDisplayName] = useState('Jarvis');
    const [aiDisplayNameMessage, setAiDisplayNameMessage] = useState('');
    const [personalityPreset, setPersonalityPreset] = useState('CLASSIC_CURRENT');
    const [personalityCustom, setPersonalityCustom] = useState(PERSONALITY_DEFAULT_CUSTOM);
    const [personalityMessage, setPersonalityMessage] = useState('');
    const [animatedRadarValues, setAnimatedRadarValues] = useState(PERSONALITY_DEFAULT_CUSTOM);
    const [restartBusy, setRestartBusy] = useState(false);
    const [restartSplashVisible, setRestartSplashVisible] = useState(false);

    const formatUnixTs = (rawTs) => {
        const n = Number.parseInt(rawTs, 10);
        if (!Number.isFinite(n) || n <= 0) return 'n/a';
        try {
            return new Date(n * 1000).toLocaleString();
        } catch {
            return 'n/a';
        }
    };

    const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
    const faceSetupVideoRef = useRef(null);
    const faceSetupStreamRef = useRef(null);
    const faceSetupTimerRef = useRef(null);
    const pendingFaceSetupPinRef = useRef('');
    const radarAnimationFrameRef = useRef(null);
    const animatedRadarValuesRef = useRef(PERSONALITY_DEFAULT_CUSTOM);

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
                if (settings.tool_enabled) {
                    setToolEnabled(settings.tool_enabled);
                } else if (settings.tool_permissions) {
                    // Backward-compatibility fallback for older backend state.
                    setToolEnabled(settings.tool_permissions);
                }
                if (settings.tool_permissions) setPermissions(settings.tool_permissions);
                if (typeof settings.face_auth_enabled !== 'undefined') {
                    setFaceAuthEnabled(settings.face_auth_enabled);
                    localStorage.setItem('face_auth_enabled', settings.face_auth_enabled);
                }
                if (typeof settings.show_lock_button !== 'undefined') {
                    setShowLockButton(Boolean(settings.show_lock_button));
                }
                if (typeof settings.power_off_pin_required !== 'undefined') {
                    setPowerOffPinRequired(Boolean(settings.power_off_pin_required));
                }
                if (typeof settings.whatsapp_monitor_enabled !== 'undefined') {
                    setWhatsappMonitorEnabled(Boolean(settings.whatsapp_monitor_enabled));
                }
                if (typeof settings.whatsapp_notify_enabled !== 'undefined') {
                    setWhatsappNotifyEnabled(Boolean(settings.whatsapp_notify_enabled));
                }
                if (typeof settings.backup_pin_configured !== 'undefined') {
                    setBackupPinConfigured(Boolean(settings.backup_pin_configured));
                }
                if (typeof settings.face_reference_configured !== 'undefined') {
                    setFaceReferenceConfigured(Boolean(settings.face_reference_configured));
                }
                if (typeof settings.long_term_memory_enabled !== 'undefined') {
                    setLongTermMemoryEnabled(Boolean(settings.long_term_memory_enabled));
                }
                if (typeof settings.memory_locked !== 'undefined') {
                    setMemoryLocked(Boolean(settings.memory_locked));
                }
                setApiKeyConfigured(Boolean(settings.gemini_api_key_configured));
                setFinnhubApiKeyConfigured(Boolean(settings.finnhub_api_key_configured));
                setSpotifyClientId(String(settings.spotify_client_id || ''));
                setSpotifyClientSecretConfigured(Boolean(settings.spotify_client_secret_configured));
                setSpotifyRedirectUri(String(settings.spotify_redirect_uri || 'http://127.0.0.1:8000/spotify/callback'));
                setSpotifyScopes(String(settings.spotify_scopes || ''));
                setSpotifyConnected(Boolean(settings.spotify_connected));
                setSpotifyConnectedUser(settings.spotify_connected_user && typeof settings.spotify_connected_user === 'object' ? settings.spotify_connected_user : {});
                setSpotifyTokenExpiresAt(Number.parseInt(settings.spotify_user_token_expires_at, 10) || 0);
                setSpotifyRefreshTokenConfigured(Boolean(settings.spotify_refresh_token_configured));
                setSpotifyAccessTokenConfigured(Boolean(settings.spotify_user_access_token_configured));
                setSpotifyLastDeviceId(String(settings.spotify_last_device_id || ''));
                setDefaultWeatherLocation(settings.default_weather_location || 'Berlin,DE');
                setVoiceName(settings.voice_name || 'Kore');
                setAiDisplayName(settings.ai_display_name || 'Jarvis');
                setPersonalityPreset(settings.personality_preset || 'CLASSIC_CURRENT');
                if (settings.personality_custom && typeof settings.personality_custom === 'object') {
                    setPersonalityCustom(sanitizePersonalityCustom(settings.personality_custom));
                }
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

        const handleSpotifyConnectionResult = (result) => {
            const ok = Boolean(result?.ok);
            const msg = String(result?.message || '').trim() || (ok ? 'Spotify action completed.' : 'Spotify action failed.');
            setSpotifyStatusMessage(msg);
            if (!ok) {
                setSpotifyConnectBusy(false);
                return;
            }

            const step = String(result?.step || '').trim();
            if (step === 'auth_url_ready') {
                const authUrl = String(result?.auth_url || '').trim();
                if (authUrl && !result?.opened_browser) {
                    try {
                        window.open(authUrl, '_blank', 'noopener,noreferrer');
                    } catch {
                        // ignore UI popup failures
                    }
                }
                setSpotifyConnectBusy(false);
                return;
            }

            if (step === 'connected' || step === 'disconnected') {
                setSpotifyConnectBusy(false);
                if (step === 'connected') {
                    setSpotifyAuthCodeInput('');
                }
            }
        };

        const handleFaceSetupResult = (result) => {
            const ok = Boolean(result?.ok);
            const msg = String(result?.message || '').trim() || (ok ? 'Face setup completed.' : 'Face setup failed.');
            setFaceSetupBusy(false);
            setFaceSetupMessage(msg);
            if (ok) {
                setFaceSetupPin('');
                setFaceSetupPinConfirm('');
            }
        };

        const handleClearMemoryResult = (result) => {
            const ok = Boolean(result?.ok);
            const msg = String(result?.message || '').trim() || (ok ? 'Long-term memory cleared.' : 'Failed to clear long-term memory.');
            setClearMemoryBusy(false);
            setClearMemoryMessage(msg);
            if (ok) {
                socket.emit('get_long_term_memory_count');
            }
        };

        const handleMemoryCountResult = (result) => {
            const ok = Boolean(result?.ok);
            if (ok) {
                const count = Number.parseInt(result?.count, 10);
                setMemoryEntryCount(Number.isFinite(count) ? count : 0);
            }
        };

        const handleMemoryQualityResult = (result) => {
            const ok = Boolean(result?.ok);
            setMemoryQualityLoading(false);
            if (ok) {
                if (result?.report && typeof result.report === 'object') {
                    setMemoryQualityReport(result.report);
                }
                const msg = String(result?.message || '').trim();
                if (msg) setMemoryQualityMessage(msg);
            } else {
                setMemoryQualityMessage(String(result?.message || 'Memory quality report failed.'));
            }
        };

        const handleBootSplashThemeResult = (result) => {
            const ok = Boolean(result?.ok);
            const theme = String(result?.theme || '').trim().toUpperCase();
            if (theme) {
                setBootSplashTheme(theme === 'CYAN_TERMINAL' ? 'CYAN_TERMINAL' : 'CINEMATIC_CRT');
            }
            if (ok && result?.message) {
                setBootSplashThemeMessage(String(result.message));
            }
        };

        const handleBootSplashThemeSaved = (result) => {
            const ok = Boolean(result?.ok);
            setBootSplashThemeBusy(false);
            const theme = String(result?.theme || '').trim().toUpperCase();
            if (theme) {
                setBootSplashTheme(theme === 'CYAN_TERMINAL' ? 'CYAN_TERMINAL' : 'CINEMATIC_CRT');
            }
            setBootSplashThemeMessage(
                String(result?.message || (ok ? 'Boot splash theme updated.' : 'Failed to update boot splash theme.'))
            );
        };

        socket.on('settings', handleSettings);
        socket.on('google_workspace_connection_result', handleGoogleConnectionResult);
        socket.on('spotify_connection_result', handleSpotifyConnectionResult);
        socket.on('face_setup_result', handleFaceSetupResult);
        socket.on('clear_long_term_memory_result', handleClearMemoryResult);
        socket.on('long_term_memory_count_result', handleMemoryCountResult);
        socket.on('memory_quality_report_result', handleMemoryQualityResult);
        socket.on('boot_splash_theme_result', handleBootSplashThemeResult);
        socket.on('boot_splash_theme_saved', handleBootSplashThemeSaved);
        socket.emit('get_long_term_memory_count');
        socket.emit('get_boot_splash_theme');
        // Also listen for legacy tool_permissions if needed, but 'settings' covers it
        // socket.on('tool_permissions', handlePermissions); 

        return () => {
            socket.off('settings', handleSettings);
            socket.off('google_workspace_connection_result', handleGoogleConnectionResult);
            socket.off('spotify_connection_result', handleSpotifyConnectionResult);
            socket.off('face_setup_result', handleFaceSetupResult);
            socket.off('clear_long_term_memory_result', handleClearMemoryResult);
            socket.off('long_term_memory_count_result', handleMemoryCountResult);
            socket.off('memory_quality_report_result', handleMemoryQualityResult);
            socket.off('boot_splash_theme_result', handleBootSplashThemeResult);
            socket.off('boot_splash_theme_saved', handleBootSplashThemeSaved);
        };
    }, [socket]);

    useEffect(() => {
        return () => {
            if (faceSetupTimerRef.current) {
                clearInterval(faceSetupTimerRef.current);
                faceSetupTimerRef.current = null;
            }
            if (faceSetupStreamRef.current) {
                faceSetupStreamRef.current.getTracks().forEach((track) => track.stop());
                faceSetupStreamRef.current = null;
            }
        };
    }, []);

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

        // Optimistic update for immediate UI feedback
        setPermissions((prev) => ({ ...prev, [toolId]: nextVal }));

        // Send update
        socket.emit('update_settings', { tool_permissions: { [toolId]: nextVal } });
    };

    const toggleToolEnabled = (toolId) => {
        const currentVal = toolEnabled[toolId] !== false; // Default True
        const nextVal = !currentVal;
        // Optimistic update for immediate UI feedback
        setToolEnabled((prev) => ({ ...prev, [toolId]: nextVal }));
        socket.emit('update_settings', { tool_enabled: { [toolId]: nextVal } });
    };

    const areToolsEnabled = (ids) => ids.every((id) => toolEnabled[id] !== false);

    const setToolGroupEnabled = (ids, enabled) => {
        const payload = ids.reduce((acc, id) => {
            acc[id] = enabled;
            return acc;
        }, {});
        // Optimistic group update for immediate UI feedback
        setToolEnabled((prev) => ({ ...prev, ...payload }));
        socket.emit('update_settings', { tool_enabled: payload });
    };

    const toggleFaceAuth = () => {
        const newVal = !faceAuthEnabled;
        setFaceAuthEnabled(newVal); // Optimistic Update
        localStorage.setItem('face_auth_enabled', newVal);
        socket.emit('update_settings', { face_auth_enabled: newVal });
    };

    const toggleShowLockButton = () => {
        const newVal = !showLockButton;
        setShowLockButton(newVal);
        socket.emit('update_settings', { show_lock_button: newVal });
    };

    const togglePowerOffPinRequired = () => {
        const newVal = !powerOffPinRequired;
        setPowerOffPinRequired(newVal);
        socket.emit('update_settings', { power_off_pin_required: newVal });
    };

    const toggleWhatsappMonitor = () => {
        const newVal = !whatsappMonitorEnabled;
        setWhatsappMonitorEnabled(newVal);
        socket.emit('update_settings', { whatsapp_monitor_enabled: newVal });
        setWhatsappMessage(newVal
            ? 'WhatsApp background monitoring enabled.'
            : 'WhatsApp background monitoring disabled.');
    };

    const toggleWhatsappNotifications = () => {
        const newVal = !whatsappNotifyEnabled;
        setWhatsappNotifyEnabled(newVal);
        socket.emit('update_settings', { whatsapp_notify_enabled: newVal });
    };

    const openWhatsappLogin = () => {
        if (ipcRenderer) {
            ipcRenderer.send('whatsapp-open-login');
        }
        setWhatsappMessage('WhatsApp Web window opened. Scan QR code to sign in.');
    };

    const stopFaceSetupCapture = () => {
        if (faceSetupTimerRef.current) {
            clearInterval(faceSetupTimerRef.current);
            faceSetupTimerRef.current = null;
        }
        if (faceSetupStreamRef.current) {
            faceSetupStreamRef.current.getTracks().forEach((track) => track.stop());
            faceSetupStreamRef.current = null;
        }
    };

    const closeFaceSetupPopup = () => {
        stopFaceSetupCapture();
        setIsFaceSetupPopupOpen(false);
    };

    const captureFaceFromPopup = () => {
        const video = faceSetupVideoRef.current;
        if (!video) {
            setFaceSetupBusy(false);
            setFaceSetupMessage('Face setup failed: Camera preview is not available.');
            closeFaceSetupPopup();
            return;
        }

        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setFaceSetupBusy(false);
            setFaceSetupMessage('Face setup failed: Cannot access canvas context.');
            closeFaceSetupPopup();
            return;
        }

        ctx.drawImage(video, 0, 0, width, height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);

        closeFaceSetupPopup();
        socket.emit('setup_face_recognition', {
            image_base64: imageDataUrl,
            pin: pendingFaceSetupPinRef.current,
        });
        setFaceSetupMessage('Saving face reference and PIN...');
    };

    const startFaceCaptureCountdown = () => {
        setFaceCaptureCountdown(5);
        faceSetupTimerRef.current = setInterval(() => {
            setFaceCaptureCountdown((prev) => {
                if (prev <= 1) {
                    if (faceSetupTimerRef.current) {
                        clearInterval(faceSetupTimerRef.current);
                        faceSetupTimerRef.current = null;
                    }
                    captureFaceFromPopup();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const setupFaceRecognition = async () => {
        const pin = String(faceSetupPin || '').trim();
        const pinConfirm = String(faceSetupPinConfirm || '').trim();

        if (!/^\d{4}$/.test(pin)) {
            setFaceSetupMessage('Backup PIN must be exactly 4 digits.');
            return;
        }
        if (pin !== pinConfirm) {
            setFaceSetupMessage('PIN confirmation does not match.');
            return;
        }

        setFaceSetupBusy(true);
        setFaceSetupMessage('Opening camera preview...');

        try {
            const constraints = selectedWebcamId
                ? { video: { deviceId: { exact: selectedWebcamId } } }
                : { video: true };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            faceSetupStreamRef.current = stream;
            pendingFaceSetupPinRef.current = pin;
            setFaceCaptureCountdown(5);
            setIsFaceSetupPopupOpen(true);

            // Wait for popup video element to mount.
            await new Promise((resolve) => setTimeout(resolve, 40));

            if (!faceSetupVideoRef.current) {
                throw new Error('Camera preview could not be initialized.');
            }

            faceSetupVideoRef.current.srcObject = stream;
            faceSetupVideoRef.current.muted = true;
            faceSetupVideoRef.current.playsInline = true;
            await faceSetupVideoRef.current.play();

            setFaceSetupMessage('Align your face. Snapshot in 5 seconds...');
            startFaceCaptureCountdown();
        } catch (error) {
            setFaceSetupBusy(false);
            setFaceSetupMessage(`Face setup failed: ${error?.message || String(error)}`);
            closeFaceSetupPopup();
        }
    };

    const toggleLongTermMemory = () => {
        const newVal = !longTermMemoryEnabled;
        setLongTermMemoryEnabled(newVal);
        socket.emit('update_settings', { long_term_memory_enabled: newVal });
    };

    const toggleMemoryLocked = () => {
        const newVal = !memoryLocked;
        setMemoryLocked(newVal);
        socket.emit('update_settings', { memory_locked: newVal });
    };

    const runMemoryQualityCheck = (openPanel = false) => {
        setMemoryQualityLoading(true);
        setMemoryQualityMessage(openPanel ? 'Building report and opening detail view...' : 'Building memory quality report...');
        if (openPanel) {
            socket.emit('trigger_memory_quality_panel');
        } else {
            socket.emit('get_memory_quality_report', { sample_limit: 1200 });
        }
    };

    const clearLongTermMemory = () => {
        setShowClearMemoryConfirm(true);
    };

    const confirmClearLongTermMemory = () => {
        setShowClearMemoryConfirm(false);
        setClearMemoryBusy(true);
        setClearMemoryMessage('Clearing long-term memory...');
        socket.emit('clear_long_term_memory');
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

    const saveFinnhubApiKey = () => {
        const trimmed = finnhubApiKeyInput.trim();
        if (!trimmed) {
            setFinnhubApiKeyMessage('Please enter a valid stock API key.');
            return;
        }

        socket.emit('update_settings', { finnhub_api_key: trimmed });
        setFinnhubApiKeyInput('');
        setFinnhubApiKeyConfigured(true);
        setFinnhubApiKeyMessage('Stock API key saved. Stock tools are now available.');
    };

    const saveSpotifySettings = () => {
        const payload = {
            spotify_client_id: String(spotifyClientId || '').trim(),
            spotify_redirect_uri: String(spotifyRedirectUri || '').trim() || 'http://127.0.0.1:8000/spotify/callback',
            spotify_scopes: String(spotifyScopes || '').trim(),
        };

        const secret = String(spotifyClientSecret || '').trim();
        if (secret) {
            payload.spotify_client_secret = secret;
        }

        socket.emit('update_settings', payload);
        if (secret) {
            setSpotifyClientSecret('');
            setSpotifyClientSecretConfigured(true);
        }
        setSpotifyStatusMessage('Spotify settings saved.');
    };

    const startSpotifyConnect = (forceReauth = false) => {
        setSpotifyConnectBusy(true);
        setSpotifyStatusMessage(forceReauth ? 'Starting Spotify reconnect...' : 'Starting Spotify connect...');
        socket.emit('spotify_start_connect', { force_reauth: forceReauth });
    };

    const completeSpotifyConnect = () => {
        const code = String(spotifyAuthCodeInput || '').trim();
        if (!code) {
            setSpotifyStatusMessage('Please paste the Spotify code or full callback URL first.');
            return;
        }

        setSpotifyConnectBusy(true);
        setSpotifyStatusMessage('Finalizing Spotify connection...');
        socket.emit('spotify_complete_connect', { code });
    };

    const disconnectSpotify = () => {
        setSpotifyConnectBusy(true);
        setSpotifyStatusMessage('Disconnecting Spotify and clearing tokens...');
        socket.emit('spotify_disconnect');
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

    const saveBootSplashTheme = () => {
        const theme = String(bootSplashTheme || '').trim().toUpperCase() === 'CYAN_TERMINAL'
            ? 'CYAN_TERMINAL'
            : 'CINEMATIC_CRT';
        setBootSplashThemeBusy(true);
        setBootSplashThemeMessage('Saving splash theme to template file...');
        socket.emit('set_boot_splash_theme', { theme });
    };

    const saveAiDisplayName = () => {
        const trimmed = String(aiDisplayName || '').trim();
        if (!trimmed) {
            setAiDisplayNameMessage('Please enter a valid AI name.');
            return;
        }

        const safeName = trimmed.slice(0, 40);
        setAiDisplayName(safeName);
        socket.emit('update_settings', { ai_display_name: safeName });
        setAiDisplayNameMessage('AI name saved. Restart is required to apply it across the full UI.');
    };

    const updatePersonalitySlider = (key, value) => {
        const parsed = Number.parseInt(value, 10);
        const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
        setPersonalityCustom((prev) => ({
            ...prev,
            [key]: clamped,
        }));
        setPersonalityMessage('');
    };

    const applyPresetPersonalityDefaults = () => {
        const presetKey = String(personalityPreset || '').trim().toUpperCase() || 'CLASSIC_CURRENT';
        const defaults = PERSONALITY_PRESET_DEFAULTS[presetKey] || PERSONALITY_DEFAULT_CUSTOM;
        setPersonalityCustom(sanitizePersonalityCustom(defaults));
        setPersonalityMessage('Preset defaults applied. Click Save Personality to persist and use after restart.');
    };

    const savePersonalityProfile = () => {
        const preset = String(personalityPreset || '').trim().toUpperCase() || 'CLASSIC_CURRENT';
        const safeCustom = sanitizePersonalityCustom(personalityCustom);

        setPersonalityCustom(safeCustom);
        socket.emit('update_settings', {
            personality_preset: preset,
            personality_custom: safeCustom,
        });
        setPersonalityMessage('Personality profile saved. Restart is required before it takes effect.');
    };

    const restartApplication = async () => {
        if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') {
            setAiDisplayNameMessage('Restart is only available in the Electron desktop app.');
            return;
        }

        try {
            setRestartBusy(true);
            setRestartSplashVisible(true);
            setAiDisplayNameMessage('Restarting ADA (frontend + backend)...');
            await ipcRenderer.invoke('app-restart');
        } catch (err) {
            setRestartBusy(false);
            setRestartSplashVisible(false);
            setAiDisplayNameMessage(`Restart failed: ${err?.message || String(err)}`);
        }
    };

    const activeAiName = String(aiDisplayName || '').trim() || 'Jarvis';

    useEffect(() => {
        animatedRadarValuesRef.current = animatedRadarValues;
    }, [animatedRadarValues]);

    useEffect(() => {
        if (radarAnimationFrameRef.current) {
            window.cancelAnimationFrame(radarAnimationFrameRef.current);
            radarAnimationFrameRef.current = null;
        }

        const target = sanitizePersonalityCustom(personalityCustom);
        const start = sanitizePersonalityCustom(animatedRadarValuesRef.current);
        const durationMs = 220;
        const startTime = performance.now();

        const tick = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);

            const next = {};
            PERSONALITY_TRAIT_DEFS.forEach((trait) => {
                const from = start[trait.key] ?? 0;
                const to = target[trait.key] ?? 0;
                next[trait.key] = Math.round(from + ((to - from) * eased));
            });

            setAnimatedRadarValues(next);

            if (t < 1) {
                radarAnimationFrameRef.current = window.requestAnimationFrame(tick);
            } else {
                radarAnimationFrameRef.current = null;
            }
        };

        radarAnimationFrameRef.current = window.requestAnimationFrame(tick);

        return () => {
            if (radarAnimationFrameRef.current) {
                window.cancelAnimationFrame(radarAnimationFrameRef.current);
                radarAnimationFrameRef.current = null;
            }
        };
    }, [personalityCustom]);

    const personalityPreviewText = useMemo(
        () => buildPersonalityPreviewText(personalityPreset, personalityCustom),
        [personalityPreset, personalityCustom]
    );

    const personalityRadar = useMemo(() => {
        const cx = 120;
        const cy = 120;
        const radius = 84;
        const traitCount = PERSONALITY_TRAIT_DEFS.length;

        const axes = PERSONALITY_TRAIT_DEFS.map((trait, index) => {
            const angle = (-Math.PI / 2) + (index * (2 * Math.PI / traitCount));
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            const labelX = cx + Math.cos(angle) * (radius + 18);
            const labelY = cy + Math.sin(angle) * (radius + 18);
            return { ...trait, angle, x, y, labelX, labelY };
        });

        const ringScales = [0.25, 0.5, 0.75, 1];
        const rings = ringScales.map((scale) => {
            const points = axes.map((axis) => {
                const x = cx + Math.cos(axis.angle) * (radius * scale);
                const y = cy + Math.sin(axis.angle) * (radius * scale);
                return `${x},${y}`;
            }).join(' ');
            return { scale, points };
        });

        const dataPoints = axes.map((axis) => {
            const rawValue = Number.parseInt(animatedRadarValues[axis.key], 10);
            const value = Number.isFinite(rawValue) ? Math.max(0, Math.min(100, rawValue)) : 0;
            const distance = (value / 100) * radius;
            const x = cx + Math.cos(axis.angle) * distance;
            const y = cy + Math.sin(axis.angle) * distance;
            return { key: axis.key, value, x, y };
        });

        return {
            cx,
            cy,
            axes,
            rings,
            dataPolygon: dataPoints.map((point) => `${point.x},${point.y}`).join(' '),
            dataPoints,
        };
    }, [animatedRadarValues]);

    const refreshBootSplashTheme = () => {
        setBootSplashThemeMessage('Loading splash theme from template file...');
        socket.emit('get_boot_splash_theme');
    };

    const renderPersonaliseTab = () => (
        <div className="space-y-5">
            <div className="flex items-center gap-2 border border-cyan-900/40 rounded-lg p-2 bg-black/25">
                <button
                    onClick={() => setPersonaliseSubTab('identity')}
                    className={`${TAB_BUTTON} ${personaliseSubTab === 'identity' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                >
                    Identity
                </button>
                <button
                    onClick={() => setPersonaliseSubTab('personality')}
                    className={`${TAB_BUTTON} ${personaliseSubTab === 'personality' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                >
                    Personality
                </button>
            </div>

            {personaliseSubTab === 'identity' && (
                <>
                    <div>
                        <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">AI Name</h3>
                        <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                            <div className="text-[10px] text-cyan-500/70 mb-2">
                                Changes all visible AI labels after restart.
                            </div>
                            <input
                                type="text"
                                value={aiDisplayName}
                                maxLength={40}
                                onChange={(e) => setAiDisplayName(e.target.value)}
                                placeholder="AI display name (e.g. Jarvis)"
                                className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                            />
                            <div className="flex items-center justify-end mt-2">
                                <button
                                    onClick={saveAiDisplayName}
                                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                                >
                                    Save AI Name
                                </button>
                            </div>
                            {aiDisplayNameMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{aiDisplayNameMessage}</p>}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Boot Splash Theme</h3>
                        <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                            <div className="text-[10px] text-cyan-500/70 mb-2">
                                This writes [BOOT] Theme directly into public/boot/console-template.txt.
                            </div>

                            <select
                                value={bootSplashTheme}
                                onChange={(e) => setBootSplashTheme(e.target.value)}
                                className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                            >
                                {SPLASH_THEME_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>

                            <p className="mt-2 text-[10px] text-cyan-400/85">
                                {SPLASH_THEME_OPTIONS.find((option) => option.id === bootSplashTheme)?.description}
                            </p>

                            <div className="flex items-center justify-end gap-2 mt-3">
                                <button
                                    onClick={refreshBootSplashTheme}
                                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-900/70 hover:bg-cyan-800 text-white"
                                >
                                    Reload From File
                                </button>
                                <button
                                    onClick={saveBootSplashTheme}
                                    disabled={bootSplashThemeBusy}
                                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white disabled:opacity-50"
                                >
                                    {bootSplashThemeBusy ? 'Saving...' : 'Save Splash Theme'}
                                </button>
                            </div>

                            {bootSplashThemeMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{bootSplashThemeMessage}</p>}
                        </div>
                    </div>
                </>
            )}

            {personaliseSubTab === 'personality' && (
                <div>
                    <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Model Personality</h3>
                    <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                        <div className="text-[10px] text-cyan-500/70 mb-2">
                            Select a default personality or build your own profile with sliders. Applied after restart.
                        </div>

                        <select
                            value={personalityPreset}
                            onChange={(e) => setPersonalityPreset(e.target.value)}
                            className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                        >
                            {PERSONALITY_PRESET_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>

                        <p className="mt-2 text-[10px] text-cyan-400/85">
                            {PERSONALITY_PRESET_OPTIONS.find((option) => option.id === personalityPreset)?.description}
                        </p>

                        <div className="mt-3 flex items-center justify-end">
                            <button
                                onClick={applyPresetPersonalityDefaults}
                                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-900/70 hover:bg-cyan-800 text-white"
                            >
                                Apply Preset Defaults
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="bg-black/35 border border-cyan-900/30 rounded p-3">
                                <div className="text-[10px] text-cyan-400/80 uppercase tracking-wider">Live Personality Preview</div>
                                <p className="mt-2 text-xs text-cyan-100/90 leading-relaxed">
                                    {personalityPreviewText}
                                </p>
                                <div className="mt-3 grid grid-cols-2 gap-1 text-[10px] text-cyan-300/85">
                                    {PERSONALITY_TRAIT_DEFS.map((trait) => (
                                        <div key={`preview-${trait.key}`} className="border border-cyan-900/35 bg-black/30 rounded px-2 py-1 flex items-center justify-between">
                                            <span>{trait.label}</span>
                                            <span>{personalityCustom[trait.key]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-black/35 border border-cyan-900/30 rounded p-3">
                                <div className="text-[10px] text-cyan-400/80 uppercase tracking-wider mb-2">Personality Radar</div>
                                <div className="flex items-center justify-center">
                                    <svg viewBox="0 0 240 240" className="w-[220px] h-[220px]">
                                        {personalityRadar.rings.map((ring) => (
                                            <polygon
                                                key={`ring-${ring.scale}`}
                                                points={ring.points}
                                                fill="none"
                                                stroke="rgba(34,211,238,0.25)"
                                                strokeWidth="1"
                                            />
                                        ))}
                                        {personalityRadar.axes.map((axis) => (
                                            <line
                                                key={`axis-${axis.key}`}
                                                x1={personalityRadar.cx}
                                                y1={personalityRadar.cy}
                                                x2={axis.x}
                                                y2={axis.y}
                                                stroke="rgba(34,211,238,0.25)"
                                                strokeWidth="1"
                                            />
                                        ))}
                                        <polygon
                                            points={personalityRadar.dataPolygon}
                                            fill="rgba(34,211,238,0.25)"
                                            stroke="rgba(34,211,238,0.95)"
                                            strokeWidth="2"
                                        />
                                        {personalityRadar.dataPoints.map((point) => (
                                            <circle
                                                key={`point-${point.key}`}
                                                cx={point.x}
                                                cy={point.y}
                                                r="3"
                                                fill="rgba(103,232,249,1)"
                                            />
                                        ))}
                                        {personalityRadar.axes.map((axis) => (
                                            <text
                                                key={`label-${axis.key}`}
                                                x={axis.labelX}
                                                y={axis.labelY}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fill="rgba(103,232,249,0.9)"
                                                fontSize="9"
                                            >
                                                {axis.label}
                                            </text>
                                        ))}
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {PERSONALITY_TRAIT_DEFS.map((trait) => (
                                <div key={`slider-${trait.key}`} className="bg-black/35 border border-cyan-900/30 rounded p-2">
                                    <div className="flex justify-between text-[10px] text-cyan-300/90 mb-1">
                                        <span>{trait.label}</span>
                                        <span>{personalityCustom[trait.key]}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={personalityCustom[trait.key]}
                                        onChange={(e) => updatePersonalitySlider(trait.key, e.target.value)}
                                        className="w-full accent-cyan-400"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-end mt-3">
                            <button
                                onClick={savePersonalityProfile}
                                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                            >
                                Save Personality
                            </button>
                        </div>

                        {personalityMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{personalityMessage}</p>}
                    </div>
                </div>
            )}
        </div>
    );

    const renderGeneralTab = () => (
        <div className="space-y-5">
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
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Stock API Key (Finnhub / Massive)</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <input
                        type="password"
                        value={finnhubApiKeyInput}
                        onChange={(e) => setFinnhubApiKeyInput(e.target.value)}
                        placeholder={finnhubApiKeyConfigured ? 'Key saved (enter new key to replace)' : 'Paste Finnhub or Massive API key'}
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-cyan-500/70">
                            {finnhubApiKeyConfigured ? 'Stored stock key detected' : 'No stock key stored yet'}
                        </span>
                        <button
                            onClick={saveFinnhubApiKey}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                        >
                            Save Key
                        </button>
                    </div>
                    {finnhubApiKeyMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{finnhubApiKeyMessage}</p>}
                </div>
            </div>

            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Spotify</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                            type="text"
                            value={spotifyClientId}
                            onChange={(e) => setSpotifyClientId(e.target.value)}
                            placeholder="Spotify Client ID"
                            className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                        />
                        <input
                            type="password"
                            value={spotifyClientSecret}
                            onChange={(e) => setSpotifyClientSecret(e.target.value)}
                            placeholder={spotifyClientSecretConfigured ? 'Client Secret saved (enter new to replace)' : 'Spotify Client Secret'}
                            className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                        />
                    </div>

                    <input
                        type="text"
                        value={spotifyRedirectUri}
                        onChange={(e) => setSpotifyRedirectUri(e.target.value)}
                        placeholder="Spotify Redirect URI"
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    />

                    <input
                        type="text"
                        value={spotifyScopes}
                        onChange={(e) => setSpotifyScopes(e.target.value)}
                        placeholder="Spotify Scopes (optional)"
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    />

                    <div className="flex items-center justify-end gap-2 mt-1">
                        <button
                            onClick={saveSpotifySettings}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                        >
                            Save Spotify Settings
                        </button>
                    </div>

                    <div className="bg-black/30 border border-cyan-900/30 rounded p-2">
                        <div className="text-[10px] text-cyan-400/80 uppercase tracking-wider mb-1">Spotify Status</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[11px] text-cyan-100/90">
                            <div>Client ID: {spotifyClientId ? 'loaded' : 'not loaded'}</div>
                            <div>Client Secret: {spotifyClientSecretConfigured ? 'loaded' : 'not loaded'}</div>
                            <div>Refresh Token: {spotifyRefreshTokenConfigured ? 'loaded' : 'not loaded'}</div>
                            <div>Access Token: {spotifyAccessTokenConfigured ? 'loaded' : 'not loaded'}</div>
                            <div>Connection: {spotifyConnected ? 'connected' : 'not connected'}</div>
                            <div>Token Expires: {formatUnixTs(spotifyTokenExpiresAt)}</div>
                            <div>User: {spotifyConnectedUser?.display_name || spotifyConnectedUser?.id || 'n/a'}</div>
                            <div>Last Device: {spotifyLastDeviceId || 'n/a'}</div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => startSpotifyConnect(false)}
                            disabled={spotifyConnectBusy}
                            className="flex-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white disabled:opacity-50"
                        >
                            Connect
                        </button>
                        <button
                            onClick={() => startSpotifyConnect(true)}
                            disabled={spotifyConnectBusy}
                            className="flex-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-900/70 hover:bg-cyan-800 text-white disabled:opacity-50"
                        >
                            Reconnect
                        </button>
                    </div>

                    <input
                        type="text"
                        value={spotifyAuthCodeInput}
                        onChange={(e) => setSpotifyAuthCodeInput(e.target.value)}
                        placeholder="Paste Spotify code OR full callback URL here"
                        className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                    />

                    <div className="flex gap-2">
                        <button
                            onClick={completeSpotifyConnect}
                            disabled={spotifyConnectBusy}
                            className="flex-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white disabled:opacity-50"
                        >
                            Complete Connection
                        </button>
                        <button
                            onClick={disconnectSpotify}
                            disabled={spotifyConnectBusy}
                            className="flex-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-red-700/75 hover:bg-red-600 text-white disabled:opacity-50"
                        >
                            Disconnect / Clear Tokens
                        </button>
                    </div>

                    {spotifyStatusMessage && <p className="mt-1 text-[10px] text-cyan-300/80">{spotifyStatusMessage}</p>}
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
        </div>
    );

    const renderSecurityTab = () => (
        <div className="space-y-5">
            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Authentication</h3>
                <ToggleRow
                    label="Face Authentication"
                    enabled={faceAuthEnabled}
                    onToggle={toggleFaceAuth}
                />
                <div className="mt-2">
                    <ToggleRow
                        label="Show Lock Button (Bottom Toolbar)"
                        enabled={showLockButton}
                        onToggle={toggleShowLockButton}
                    />
                </div>
                <div className="mt-2">
                    <ToggleRow
                        label="Require PIN For Power Off"
                        enabled={powerOffPinRequired}
                        onToggle={togglePowerOffPinRequired}
                    />
                </div>
                <div className="mt-3 bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <div className="text-[10px] text-cyan-500/80 uppercase">Setup Face Recognition</div>
                    <p className="text-[10px] text-cyan-500/70 mt-1">
                        Captures one face reference image from your selected webcam and stores a backup unlock PIN.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <input
                            type="password"
                            maxLength={4}
                            value={faceSetupPin}
                            onChange={(e) => setFaceSetupPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="4-digit PIN"
                            className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                        />
                        <input
                            type="password"
                            maxLength={4}
                            value={faceSetupPinConfirm}
                            onChange={(e) => setFaceSetupPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="Confirm PIN"
                            className="w-full bg-gray-900 border border-cyan-800 rounded p-2 text-xs text-cyan-100 focus:border-cyan-400 outline-none"
                        />
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                        <span className="text-[10px] text-cyan-500/70">
                            Face: {faceReferenceConfigured ? 'configured' : 'not configured'} | PIN: {backupPinConfigured ? 'configured' : 'not configured'}
                        </span>
                        <button
                            onClick={setupFaceRecognition}
                            disabled={faceSetupBusy}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white disabled:opacity-50"
                        >
                            {faceSetupBusy ? 'Setting up...' : 'Setup Face + PIN'}
                        </button>
                    </div>
                    {faceSetupMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{faceSetupMessage}</p>}
                </div>
            </div>

        </div>
    );

    const renderMemoryTab = () => {
        const quality = memoryQualityReport?.quality || {};
        const policy = memoryQualityReport?.policy_stats || {};
        const byRoom = Array.isArray(quality?.by_room) ? quality.by_room : [];
        const byType = Array.isArray(quality?.by_type) ? quality.by_type : [];

        const avgConfidence = Number.isFinite(Number(quality?.avg_confidence)) ? Number(quality.avg_confidence) : 0;
        const noiseRatio = Number.isFinite(Number(quality?.noise_ratio)) ? Number(quality.noise_ratio) : 0;
        const duplicateRatio = Number.isFinite(Number(quality?.duplicate_ratio)) ? Number(quality.duplicate_ratio) : 0;

        return (
            <div className="space-y-5">
                <div>
                    <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">Memory Controls</h3>
                    <div className="space-y-2">
                        <ToggleRow
                            label="Persistent Memory"
                            enabled={longTermMemoryEnabled}
                            onToggle={toggleLongTermMemory}
                        />
                        <ToggleRow
                            label="Memory Lock (read/write block)"
                            enabled={memoryLocked}
                            onToggle={toggleMemoryLocked}
                        />
                    </div>
                    <p className="mt-2 text-[10px] text-cyan-500/70">
                        Persistent memory stores long-term context. Lock blocks memory access without disabling settings.
                    </p>
                </div>

                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="text-[10px] text-cyan-300/90 uppercase tracking-wider">Memory Quality</div>
                            <div className="text-[10px] text-cyan-500/70 mt-1">Current entries: {memoryEntryCount === null ? 'loading...' : memoryEntryCount}</div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => runMemoryQualityCheck(false)}
                                disabled={memoryQualityLoading}
                                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white disabled:opacity-50"
                            >
                                {memoryQualityLoading ? 'Running...' : 'Check Quality'}
                            </button>
                            <button
                                onClick={() => runMemoryQualityCheck(true)}
                                disabled={memoryQualityLoading}
                                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-900/70 hover:bg-cyan-800 text-white disabled:opacity-50"
                            >
                                Open In Detail View
                            </button>
                        </div>
                    </div>
                    {memoryQualityMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{memoryQualityMessage}</p>}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                    <div className="border border-cyan-700/40 rounded p-2 text-cyan-100 bg-black/30">Total: {memoryQualityReport?.total_entries ?? 0}</div>
                    <div className="border border-cyan-700/40 rounded p-2 text-cyan-100 bg-black/30">Sample: {quality?.sampled_entries ?? 0}</div>
                    <div className="border border-emerald-500/30 rounded p-2 text-emerald-200 bg-black/30">Avg conf: {(avgConfidence * 100).toFixed(1)}%</div>
                    <div className="border border-amber-500/30 rounded p-2 text-amber-200 bg-black/30">Noise: {(noiseRatio * 100).toFixed(1)}%</div>
                    <div className="border border-red-500/30 rounded p-2 text-red-200 bg-black/30">Dupes: {(duplicateRatio * 100).toFixed(1)}%</div>
                    <div className="border border-cyan-700/40 rounded p-2 text-cyan-200 bg-black/30">Long: {quality?.long_entries ?? 0}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-gray-900/35 border border-cyan-900/30 rounded-md p-3">
                        <div className="text-[10px] text-cyan-300/85 uppercase tracking-wider mb-2">Policy Counters (session)</div>
                        <div className="space-y-1 text-[11px] text-cyan-100/90">
                            <div>Saved: {policy?.saved ?? 0}</div>
                            <div>Filtered: {policy?.filtered ?? 0}</div>
                            <div>Duplicates: {policy?.duplicates ?? 0}</div>
                            <div>Manual saved: {policy?.manual_saved ?? 0}</div>
                            <div>Manual duplicates: {policy?.manual_duplicates ?? 0}</div>
                        </div>
                    </div>
                    <div className="bg-gray-900/35 border border-cyan-900/30 rounded-md p-3">
                        <div className="text-[10px] text-cyan-300/85 uppercase tracking-wider mb-2">Top Rooms</div>
                        <div className="space-y-1 text-[11px] text-cyan-100/90">
                            {byRoom.length === 0 && <div className="text-cyan-500/70">No data yet.</div>}
                            {byRoom.map((item) => (
                                <div key={`settings-room-${item?.name}`} className="flex justify-between">
                                    <span>{item?.name || 'unknown'}</span>
                                    <span>{item?.count ?? 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-900/35 border border-cyan-900/30 rounded-md p-3">
                        <div className="text-[10px] text-cyan-300/85 uppercase tracking-wider mb-2">Top Memory Types</div>
                        <div className="space-y-1 text-[11px] text-cyan-100/90">
                            {byType.length === 0 && <div className="text-cyan-500/70">No data yet.</div>}
                            {byType.map((item) => (
                                <div key={`settings-type-${item?.name}`} className="flex justify-between">
                                    <span>{item?.name || 'unknown'}</span>
                                    <span>{item?.count ?? 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-red-900/20 via-gray-900/60 to-black/70 border border-red-900/50 rounded-md p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-[10px] text-red-300/90 uppercase tracking-wider">Danger Zone</div>
                            <p className="mt-1 text-[10px] text-red-300/70">
                                Permanently removes all stored long-term memory vectors.
                            </p>
                        </div>
                        <button
                            onClick={clearLongTermMemory}
                            disabled={clearMemoryBusy}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-red-700/70 hover:bg-red-600 text-white disabled:opacity-50"
                        >
                            {clearMemoryBusy ? 'Clearing...' : 'Clear Memory'}
                        </button>
                    </div>
                    <p className="mt-2 text-[10px] text-red-200/80">
                        Current entries: {memoryEntryCount === null ? 'loading...' : memoryEntryCount}
                    </p>
                    {clearMemoryMessage && <p className="mt-2 text-[10px] text-red-200/90">{clearMemoryMessage}</p>}
                </div>

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
        );
    };

    const renderSmartHomeTab = () => (
        <div className="space-y-5">
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

    const renderSocialTab = () => (
        <div className="space-y-5">
            <div>
                <h3 className="text-cyan-300 font-semibold text-xs uppercase tracking-wider mb-2">WhatsApp Web</h3>
                <div className="bg-gray-900/40 border border-cyan-900/30 rounded-md p-3 space-y-2">
                    <ToggleRow
                        label="Enable Background Monitor"
                        enabled={whatsappMonitorEnabled}
                        onToggle={toggleWhatsappMonitor}
                    />
                    <ToggleRow
                        label="Desktop Notifications on New Messages"
                        enabled={whatsappNotifyEnabled}
                        onToggle={toggleWhatsappNotifications}
                    />

                    <div className="flex items-center justify-between mt-3">
                        <span className="text-[10px] text-cyan-500/70">Open WhatsApp Web login/session window</span>
                        <button
                            onClick={openWhatsappLogin}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white"
                        >
                            Open WhatsApp Login
                        </button>
                    </div>

                    {whatsappMessage && <p className="mt-2 text-[10px] text-cyan-300/80">{whatsappMessage}</p>}
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

        </div>
    );

    const renderToolsTab = () => {
        const selectedGroup = groupedTools.find((g) => g.group === activeToolGroup) || groupedTools[0];
        const printerToolsEnabled = areToolsEnabled(PRINTER_TOOL_IDS);
        const smartHomeToolsEnabled = areToolsEnabled(SMART_HOME_TOOL_IDS);
        const whatsappToolsEnabled = areToolsEnabled(WHATSAPP_TOOL_IDS);
        const weatherToolsEnabled = areToolsEnabled(WEATHER_TOOL_IDS);
        const stockToolsEnabled = areToolsEnabled(STOCK_TOOL_IDS);
        const spotifyToolsEnabled = areToolsEnabled(SPOTIFY_TOOL_IDS);
        const routeToolsEnabled = areToolsEnabled(ROUTE_TOOL_IDS);
        const fileProjectToolsEnabled = areToolsEnabled(FILE_PROJECT_TOOL_IDS);
        const memoryToolsEnabled = areToolsEnabled(MEMORY_TOOL_IDS);
        const dateTimeToolEnabled = areToolsEnabled(DATETIME_TOOL_IDS);
        const cadToolsEnabled = areToolsEnabled(CAD_TOOL_IDS);
        const webAgentToolsEnabled = areToolsEnabled(WEB_AGENT_TOOL_IDS);
        const calendarMailToolsEnabled = areToolsEnabled(CALENDAR_MAIL_TOOL_IDS);
        const systemCheckEnabled = toolEnabled.system_check !== false;

        return (
            <div className="space-y-4">
                <div className="border border-cyan-900/40 rounded-lg p-3 bg-black/25">
                    <div className="text-cyan-300 text-xs uppercase tracking-wider font-semibold mb-2">Quick Toggles</div>
                    <ToggleRow
                        label="Smart Home Tools (all)"
                        enabled={smartHomeToolsEnabled}
                        onToggle={() => setToolGroupEnabled(SMART_HOME_TOOL_IDS, !smartHomeToolsEnabled)}
                    />
                    <ToggleRow
                        label="Printer Tools (all)"
                        enabled={printerToolsEnabled}
                        onToggle={() => setToolGroupEnabled(PRINTER_TOOL_IDS, !printerToolsEnabled)}
                    />
                    <ToggleRow
                        label="WhatsApp Tools (all)"
                        enabled={whatsappToolsEnabled}
                        onToggle={() => setToolGroupEnabled(WHATSAPP_TOOL_IDS, !whatsappToolsEnabled)}
                    />
                    <ToggleRow
                        label="Weather Tools (all)"
                        enabled={weatherToolsEnabled}
                        onToggle={() => setToolGroupEnabled(WEATHER_TOOL_IDS, !weatherToolsEnabled)}
                    />
                    <ToggleRow
                        label="Stock Tools (all)"
                        enabled={stockToolsEnabled}
                        onToggle={() => setToolGroupEnabled(STOCK_TOOL_IDS, !stockToolsEnabled)}
                    />
                    <ToggleRow
                        label="Spotify Tools (all)"
                        enabled={spotifyToolsEnabled}
                        onToggle={() => setToolGroupEnabled(SPOTIFY_TOOL_IDS, !spotifyToolsEnabled)}
                    />
                    <ToggleRow
                        label="Route Tools"
                        enabled={routeToolsEnabled}
                        onToggle={() => setToolGroupEnabled(ROUTE_TOOL_IDS, !routeToolsEnabled)}
                    />
                    <ToggleRow
                        label="File + Project Tools (all)"
                        enabled={fileProjectToolsEnabled}
                        onToggle={() => setToolGroupEnabled(FILE_PROJECT_TOOL_IDS, !fileProjectToolsEnabled)}
                    />
                    <ToggleRow
                        label="Memory Tools (all)"
                        enabled={memoryToolsEnabled}
                        onToggle={() => setToolGroupEnabled(MEMORY_TOOL_IDS, !memoryToolsEnabled)}
                    />
                    <ToggleRow
                        label="DateTime Tool"
                        enabled={dateTimeToolEnabled}
                        onToggle={() => setToolGroupEnabled(DATETIME_TOOL_IDS, !dateTimeToolEnabled)}
                    />
                    <ToggleRow
                        label="CAD Prototype Tools"
                        enabled={cadToolsEnabled}
                        onToggle={() => setToolGroupEnabled(CAD_TOOL_IDS, !cadToolsEnabled)}
                    />
                    <ToggleRow
                        label="Web Agent Tools"
                        enabled={webAgentToolsEnabled}
                        onToggle={() => setToolGroupEnabled(WEB_AGENT_TOOL_IDS, !webAgentToolsEnabled)}
                    />
                    <ToggleRow
                        label="Calendar + Mail Tools (all)"
                        enabled={calendarMailToolsEnabled}
                        onToggle={() => setToolGroupEnabled(CALENDAR_MAIL_TOOL_IDS, !calendarMailToolsEnabled)}
                    />
                    <ToggleRow
                        label="System Check"
                        enabled={systemCheckEnabled}
                        onToggle={() => toggleToolEnabled('system_check')}
                    />
                </div>

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
                    <div className="text-[11px] text-cyan-300/90 uppercase tracking-wider">Tool Activation</div>
                    {(selectedGroup?.items || []).map((tool) => {
                        const isActive = toolEnabled[tool.id] !== false;
                        return (
                            <ToggleRow
                                key={`enabled-${tool.id}`}
                                label={tool.label}
                                enabled={isActive}
                                onToggle={() => toggleToolEnabled(tool.id)}
                            />
                        );
                    })}

                    <div className="pt-3 text-[11px] text-cyan-300/90 uppercase tracking-wider">Ask For Permission</div>
                    {(selectedGroup?.items || []).map((tool) => {
                        const isRequired = permissions[tool.id] !== false;
                        return (
                            <ToggleRow
                                key={`perm-${tool.id}`}
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
        <>
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
                        onClick={() => setActiveTab('security')}
                        className={`${TAB_BUTTON} ${activeTab === 'security' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                    >
                        Security
                    </button>
                    <button
                        onClick={() => setActiveTab('devices')}
                        className={`${TAB_BUTTON} ${activeTab === 'devices' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                    >
                        Devices
                    </button>
                    <button
                        onClick={() => setActiveTab('social')}
                        className={`${TAB_BUTTON} ${activeTab === 'social' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                    >
                        Social Accounts
                    </button>
                    <button
                        onClick={() => setActiveTab('smart-home')}
                        className={`${TAB_BUTTON} ${activeTab === 'smart-home' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                    >
                        Smart Home
                    </button>
                    <button
                        onClick={() => setActiveTab('tools')}
                        className={`${TAB_BUTTON} ${activeTab === 'tools' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                    >
                        Tool Permissions
                    </button>
                    <button
                        onClick={() => setActiveTab('memory')}
                        className={`${TAB_BUTTON} ${activeTab === 'memory' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                    >
                        Memory
                    </button>
                    <button
                        onClick={() => setActiveTab('personalise')}
                        className={`${TAB_BUTTON} ${activeTab === 'personalise' ? 'border-cyan-400 bg-cyan-900/20 text-cyan-200' : 'border-cyan-900/40 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                    >
                        Personalise
                    </button>
                    <button
                        onClick={restartApplication}
                        disabled={restartBusy}
                        className="ml-auto text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-700/70 hover:bg-cyan-600 text-white disabled:opacity-50"
                    >
                        {restartBusy ? `Restarting ${activeAiName}...` : `Restart ${activeAiName}`}
                    </button>
                </div>

                <div
                    className="px-4 py-4 overflow-y-auto scrollbar-hide"
                    style={{ height: `calc(100% - ${HEADER_HEIGHT + 44}px)` }}
                >
                    {activeTab === 'general' && renderGeneralTab()}
                    {activeTab === 'security' && renderSecurityTab()}
                    {activeTab === 'devices' && renderDevicesTab()}
                    {activeTab === 'social' && renderSocialTab()}
                    {activeTab === 'smart-home' && renderSmartHomeTab()}
                    {activeTab === 'tools' && renderToolsTab()}
                    {activeTab === 'memory' && renderMemoryTab()}
                    {activeTab === 'personalise' && renderPersonaliseTab()}
                </div>
            </div>

            {showClearMemoryConfirm && (
                <div className="fixed inset-0 z-[72] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-black/95 border border-red-700/50 rounded-xl shadow-[0_0_35px_rgba(220,38,38,0.2)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-red-900/60 bg-gradient-to-r from-red-950/70 via-black/50 to-black/40">
                            <h3 className="text-red-200 text-sm uppercase tracking-wider">Confirm Memory Wipe</h3>
                            <p className="text-[10px] text-red-300/75 mt-1">
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="p-4">
                            <p className="text-xs text-red-100/90 leading-relaxed">
                                You are about to permanently delete all long-term memory entries.
                            </p>
                            <p className="mt-2 text-[11px] text-red-200/80">
                                Entries to remove: {memoryEntryCount === null ? 'loading...' : memoryEntryCount}
                            </p>
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={() => setShowClearMemoryConfirm(false)}
                                    className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border border-cyan-900/50 bg-black/50 text-cyan-200 hover:border-cyan-600/70"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmClearLongTermMemory}
                                    disabled={clearMemoryBusy}
                                    className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded bg-red-700/85 hover:bg-red-600 text-white disabled:opacity-50"
                                >
                                    {clearMemoryBusy ? 'Clearing...' : 'Delete All'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {restartSplashVisible && (
                <div className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-xl border border-cyan-500/40 bg-black/95 shadow-[0_0_55px_rgba(6,182,212,0.25)] overflow-hidden">
                        <div className="px-5 py-4 border-b border-cyan-900/50 bg-gradient-to-r from-cyan-950/40 via-black/60 to-black/60">
                            <h3 className="text-cyan-200 text-sm uppercase tracking-[0.18em]">Restarting {activeAiName}</h3>
                            <p className="mt-1 text-[10px] text-cyan-400/80 uppercase tracking-[0.12em]">System restart in progress</p>
                        </div>
                        <div className="px-5 py-6">
                            <div className="flex items-center gap-3 text-cyan-200/95">
                                <div className="h-5 w-5 rounded-full border-2 border-cyan-500/40 border-t-cyan-300 animate-spin" />
                                <span className="text-xs tracking-wide">Restarting frontend and backend. Please wait...</span>
                            </div>
                            <div className="mt-4 h-1.5 w-full rounded-full bg-cyan-950/60 overflow-hidden">
                                <div className="h-full w-1/3 bg-cyan-400/80 animate-pulse" />
                            </div>
                            <p className="mt-4 text-[11px] text-cyan-400/75 leading-relaxed">
                                UI controls are temporarily locked until restart is complete.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {isFaceSetupPopupOpen && (
                <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-black/95 border border-cyan-500/50 rounded-xl shadow-[0_0_35px_rgba(6,182,212,0.25)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-cyan-900/50 flex items-center justify-between">
                            <h3 className="text-cyan-300 text-sm uppercase tracking-wider">Face Setup Capture</h3>
                            <button
                                onClick={() => {
                                    setFaceSetupBusy(false);
                                    setFaceSetupMessage('Face setup canceled.');
                                    closeFaceSetupPopup();
                                }}
                                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-cyan-900/60 hover:bg-cyan-800/70 text-cyan-200"
                            >
                                Cancel
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="relative rounded-lg border border-cyan-900/40 overflow-hidden bg-black">
                                <video
                                    ref={faceSetupVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-auto max-h-[420px] object-cover"
                                />
                                <div className="absolute inset-0 pointer-events-none border-[3px] border-cyan-400/30" />
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 border border-cyan-400/40 rounded-full px-4 py-1 text-cyan-200 text-lg font-bold tracking-widest">
                                    {faceCaptureCountdown}
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-cyan-300/85 text-center">
                                Bitte ruhig in die Kamera schauen. Aufnahme erfolgt automatisch nach 5 Sekunden.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SettingsWindow;
