import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, CalendarDays, Mail } from 'lucide-react';

const formatTime = (value) => {
    if (!value) return '-';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleString();
    } catch {
        return String(value);
    }
};

const buildWindyEmbedUrl = (lat, lon) => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return '';
    const zoom = 8;
    return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=100%25&height=100%25&zoom=${zoom}&level=surface&overlay=temp&product=ecmwf&menu=&message=&marker=true&calendar=&pressure=&type=map&location=coordinates&metricWind=default&metricTemp=default`;
};

const formatEmailBodyParagraphs = (text) => {
    const clean = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!clean) return [];

    const paragraphs = clean
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 80);

    return paragraphs;
};

const EmptyState = () => (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 text-cyan-300/80 text-center px-8 overflow-hidden">
        <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border border-cyan-500/40 animate-pulse" />
            <div className="absolute inset-2 rounded-full border border-cyan-400/30 animate-pulse" />
            <div className="absolute inset-4 rounded-full border border-cyan-300/20 animate-pulse" />
        </div>
        <div className="text-cyan-200/85 text-sm tracking-[0.25em] uppercase font-semibold">
            Detail Info
        </div>
    </div>
);

const ModeHeader = ({ activeMode }) => {
    const modes = [
        { id: 'weather', label: 'Wetter', Icon: CloudSun },
        { id: 'calendar', label: 'Kalender', Icon: CalendarDays },
        { id: 'mail', label: 'Mail', Icon: Mail },
    ];

    return (
        <div className="h-10 border-b border-cyan-900/40 bg-black/25 px-3 flex items-center justify-center gap-2">
            {modes.map(({ id, label, Icon }) => {
                const isActive = activeMode === id;
                return (
                    <div
                        key={id}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase tracking-wider border transition-all duration-300 ${isActive
                                ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                                : 'border-cyan-900/50 bg-black/30 text-cyan-700/80'
                            }`}
                        title={label}
                    >
                        <Icon size={12} />
                        <span>{label}</span>
                    </div>
                );
            })}
        </div>
    );
};

const WeatherView = ({ payload }) => {
    const weather = payload?.weather || payload?.forecast || {};
    const coord = weather?.coord || {};
    const lat = typeof coord?.lat === 'number' ? coord.lat : Number(coord?.lat);
    const lon = typeof coord?.lon === 'number' ? coord.lon : Number(coord?.lon);
    const mapUrl = buildWindyEmbedUrl(lat, lon);

    const locationLabel = [weather?.location, weather?.country].filter(Boolean).join(', ');

    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'Wetterkarte'}</div>
                <div className="text-cyan-100/80 text-xs mt-1">{locationLabel || 'Unbekannter Ort'}</div>
            </div>
            <div className="flex-1 relative bg-black/40">
                {mapUrl ? (
                    <iframe
                        title="weather-map"
                        src={mapUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-cyan-400/70 px-4 text-center">
                        Keine Koordinaten verfuegbar. Bitte Wetter fuer einen konkreten Ort anfragen.
                    </div>
                )}
            </div>
        </div>
    );
};

const CalendarView = ({ payload }) => {
    const events = Array.isArray(payload?.events) ? payload.events : [];

    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'Kalender'}</div>
                <div className="text-cyan-100/70 text-xs mt-1">{events.length} Termin(e)</div>
            </div>
            <div className="flex-1 overflow-auto scrollbar-hide p-3 space-y-2">
                {events.length === 0 && (
                    <div className="text-xs text-cyan-400/70">Keine Termine gefunden.</div>
                )}
                {events.map((event) => (
                    <div key={event.id || `${event.summary}-${event.start}`} className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                        <div className="text-cyan-200 text-sm font-semibold">{event.summary || '(No title)'}</div>
                        <div className="text-cyan-100/70 text-xs mt-1">Start: {formatTime(event.start)}</div>
                        {event.end && <div className="text-cyan-100/70 text-xs">Ende: {formatTime(event.end)}</div>}
                        {event.location && <div className="text-cyan-400/80 text-xs mt-1">Ort: {event.location}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const EmailView = ({ payload }) => {
    const email = payload?.email || {};
    const body = String(email?.body || email?.snippet || '').trim();
    const paragraphs = formatEmailBodyParagraphs(body);

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-cyan-900/40 bg-gradient-to-r from-cyan-950/40 to-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'E-Mail Detail'}</div>
                <div className="text-cyan-100 text-base mt-2 font-semibold leading-snug">{email?.subject || '(No subject)'}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-1 rounded-full bg-cyan-900/30 border border-cyan-700/40 text-cyan-100/85 truncate max-w-[95%]">From: {email?.from || '-'}</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-900/20 border border-cyan-700/30 text-cyan-100/80 truncate max-w-[95%]">To: {email?.to || '-'}</span>
                    <span className="px-2 py-1 rounded-full bg-black/40 border border-cyan-900/40 text-cyan-200/70">{email?.date || '-'}</span>
                </div>
            </div>
            <div className="flex-1 overflow-auto scrollbar-hide px-4 py-3 bg-black/20">
                {paragraphs.length === 0 ? (
                    <div className="text-sm text-cyan-200/70">Kein Inhalt verfuegbar.</div>
                ) : (
                    <div className="space-y-3">
                        {paragraphs.map((p, idx) => (
                            <p key={`${idx}-${p.slice(0, 24)}`} className="text-[13px] text-cyan-100/90 leading-relaxed tracking-[0.01em] break-words">
                                {p}
                            </p>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const EmailListView = ({ payload }) => {
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];

    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'Gmail'}</div>
                <div className="text-cyan-100/70 text-xs mt-1">{messages.length} Nachricht(en)</div>
            </div>
            <div className="flex-1 overflow-auto scrollbar-hide p-3 space-y-2">
                {messages.length === 0 && (
                    <div className="text-xs text-cyan-400/70">Keine Nachrichten gefunden.</div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id || `${msg.subject}-${msg.date}`} className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                        <div className="text-cyan-200 text-sm font-semibold truncate">{msg.subject || '(No subject)'}</div>
                        <div className="text-cyan-100/70 text-xs mt-1 truncate">Von: {msg.from || '-'}</div>
                        <div className="text-cyan-100/60 text-xs truncate">{msg.date || '-'}</div>
                        <div className="text-cyan-300/80 text-xs mt-1 line-clamp-3">{msg.snippet || ''}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LeftToolView = ({ payload }) => {
    const [fadeKey, setFadeKey] = useState(0);

    const mode = useMemo(() => {
        if (!payload?.type || payload.type === 'clear') return 'none';
        if (payload.type === 'weather') return 'weather';
        if (payload.type === 'calendar') return 'calendar';
        if (payload.type === 'email' || payload.type === 'email_list') return 'mail';
        return 'none';
    }, [payload]);

    useEffect(() => {
        setFadeKey((prev) => prev + 1);
    }, [payload?.type, payload?.title]);

    let content = <EmptyState />;
    if (payload?.type === 'weather') content = <WeatherView payload={payload} />;
    if (payload?.type === 'calendar') content = <CalendarView payload={payload} />;
    if (payload?.type === 'email') content = <EmailView payload={payload} />;
    if (payload?.type === 'email_list') content = <EmailListView payload={payload} />;
    if (payload?.type === 'clear') content = <EmptyState />;

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            <div className="h-9 border-b border-cyan-900/40 bg-black/45 px-3 flex items-center justify-between">
                <span className="text-cyan-200 text-xs tracking-[0.25em] uppercase font-semibold">Detail View</span>
                <span className="text-cyan-500/70 text-[10px] uppercase tracking-wider">Live</span>
            </div>
            <ModeHeader activeMode={mode} />
            <div key={fadeKey} className="flex-1 animate-fade-in overflow-hidden">
                {content}
            </div>
        </div>
    );
};

export default LeftToolView;
