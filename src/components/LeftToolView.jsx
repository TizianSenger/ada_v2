import React, { useEffect, useMemo, useState } from 'react';
import {
    CloudSun,
    CalendarDays,
    Mail,
    Route,
    ShieldCheck,
    ArrowUp,
    ArrowLeft,
    ArrowRight,
    CornerUpLeft,
    CornerUpRight,
    RotateCcw,
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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
        { id: 'route', label: 'Route', Icon: Route },
        { id: 'system', label: 'System', Icon: ShieldCheck },
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

const RouteFitBounds = ({ geometry }) => {
    const map = useMap();

    useEffect(() => {
        if (!Array.isArray(geometry) || geometry.length === 0) return;
        map.fitBounds(geometry, { padding: [20, 20] });
    }, [map, geometry]);

    return null;
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

const RouteView = ({ payload }) => {
    const route = payload?.route || {};
    const steps = Array.isArray(route?.steps) ? route.steps : [];
    const geometry = Array.isArray(route?.geometry) ? route.geometry : [];
    const fromLabel = route?.origin?.label || '-';
    const toLabel = route?.destination?.label || '-';
    const startPos = route?.origin?.lat && route?.origin?.lon ? [route.origin.lat, route.origin.lon] : null;
    const endPos = route?.destination?.lat && route?.destination?.lon ? [route.destination.lat, route.destination.lon] : null;
    const fallbackCenter = startPos || [48.7665, 11.4257];

    const getStepDirection = (instruction) => {
        const text = String(instruction || '').toLowerCase();

        if (text.includes('uturn') || text.includes('u-turn')) {
            return {
                Icon: RotateCcw,
                colorClass: 'text-pink-300 bg-pink-500/15 border-pink-400/40',
                label: 'U-Turn',
            };
        }

        if (text.includes('slight left') || text.includes('left')) {
            const slight = text.includes('slight left');
            return {
                Icon: slight ? CornerUpLeft : ArrowLeft,
                colorClass: 'text-blue-300 bg-blue-500/15 border-blue-400/40',
                label: slight ? 'Leicht links' : 'Links',
            };
        }

        if (text.includes('slight right') || text.includes('right')) {
            const slight = text.includes('slight right');
            return {
                Icon: slight ? CornerUpRight : ArrowRight,
                colorClass: 'text-orange-300 bg-orange-500/15 border-orange-400/40',
                label: slight ? 'Leicht rechts' : 'Rechts',
            };
        }

        return {
            Icon: ArrowUp,
            colorClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/40',
            label: 'Geradeaus',
        };
    };

    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'Route Plan'}</div>
                <div className="text-cyan-100/80 text-xs mt-1 truncate">Von: {fromLabel}</div>
                <div className="text-cyan-100/80 text-xs truncate">Nach: {toLabel}</div>
                <div className="text-cyan-200/80 text-xs mt-1">
                    {route?.distance_km ?? 'n/a'} km | {route?.duration_human || `${route?.duration_min ?? 'n/a'} min`} | {route?.mode || 'driving'}
                </div>
                {route?.traffic_note && (
                    <div className="text-[10px] text-yellow-300/80 mt-1">{route.traffic_note}</div>
                )}
            </div>
            <div className="h-[48%] relative bg-black/40 border-b border-cyan-900/30">
                {geometry.length > 1 ? (
                    <MapContainer
                        center={fallbackCenter}
                        zoom={11}
                        scrollWheelZoom={true}
                        className="absolute inset-0 w-full h-full"
                    >
                        <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <RouteFitBounds geometry={geometry} />
                        <Polyline positions={geometry} pathOptions={{ color: '#22d3ee', weight: 5, opacity: 0.9 }} />
                        {startPos && (
                            <CircleMarker center={startPos} radius={6} pathOptions={{ color: '#34d399', fillColor: '#34d399', fillOpacity: 0.9 }}>
                                <Popup>Start</Popup>
                            </CircleMarker>
                        )}
                        {endPos && (
                            <CircleMarker center={endPos} radius={6} pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.9 }}>
                                <Popup>Ziel</Popup>
                            </CircleMarker>
                        )}
                    </MapContainer>
                ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-xs text-cyan-400/70 px-4 text-center gap-2">
                        <div>Keine Kartenlinie verfuegbar.</div>
                        {route?.osm_directions_url && (
                            <a
                                href={route.osm_directions_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-300 underline"
                            >
                                Route in OpenStreetMap oeffnen
                            </a>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-auto scrollbar-hide p-3 space-y-2">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-semibold">Schritte</div>
                {steps.length === 0 && (
                    <div className="text-xs text-cyan-400/70">Keine Schrittliste verfuegbar.</div>
                )}
                {steps.map((step, idx) => (
                    <div key={`${idx}-${step.instruction || ''}`} className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                        {(() => {
                            const direction = getStepDirection(step.instruction);
                            const DirectionIcon = direction.Icon;

                            return (
                                <div className="flex items-start gap-2">
                                    <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-md border flex items-center justify-center ${direction.colorClass}`}>
                                        <DirectionIcon size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-cyan-100/90 text-xs">{idx + 1}. {step.instruction || 'Weiter'}</div>
                                        <div className="text-[11px] mt-1 text-cyan-400/80">
                                            {direction.label} | {step.distance_km ?? 'n/a'} km
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ))}
            </div>
        </div>
    );
};

const SystemCheckView = ({ payload }) => {
    const report = payload?.report || {};
    const summary = report?.summary || {};
    const checks = Array.isArray(report?.checks) ? report.checks : [];
    const progress = payload?.progress || {};
    const isRunning = payload?.status === 'running' || summary?.running === true;

    const totalChecksRaw = progress?.total ?? summary?.total ?? checks.length;
    const completedChecksRaw = progress?.completed ?? summary?.completed ?? checks.length;
    const progressPercentRaw = progress?.percent ?? summary?.progress_percent;

    const totalChecks = Number.isFinite(Number(totalChecksRaw)) ? Number(totalChecksRaw) : checks.length;
    const completedChecks = Number.isFinite(Number(completedChecksRaw)) ? Number(completedChecksRaw) : checks.length;
    const fallbackPercent = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;
    const progressPercent = Math.max(0, Math.min(100, Number.isFinite(Number(progressPercentRaw)) ? Number(progressPercentRaw) : fallbackPercent));
    const currentCheck = String(progress?.current_check || '');

    const badgeClass = (status) => {
        if (status === 'pass') return 'text-emerald-300 bg-emerald-500/15 border-emerald-400/40';
        if (status === 'warn') return 'text-amber-300 bg-amber-500/15 border-amber-400/40';
        return 'text-red-300 bg-red-500/15 border-red-400/40';
    };

    return (
        <div className="h-full w-full flex flex-col">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'System Check Report'}</div>
                <div className="text-cyan-100/75 text-xs mt-1">
                    {summary?.timestamp ? `Zeit: ${formatTime(summary.timestamp)}` : 'Zeit: -'}
                </div>
                <div className={`text-[11px] mt-1 ${isRunning ? 'text-cyan-300/95' : 'text-emerald-300/90'}`}>
                    {isRunning ? 'Diagnose laeuft...' : 'Diagnose abgeschlossen'}
                </div>
                {currentCheck && (
                    <div className="text-[11px] mt-1 text-cyan-400/85 truncate">
                        Aktueller Check: {currentCheck}
                    </div>
                )}
                <div className="mt-2">
                    <div className="h-2.5 rounded-full bg-cyan-950/60 border border-cyan-900/60 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-cyan-300/80">
                        <span>{progressPercent}%</span>
                        <span>{completedChecks}/{totalChecks} Systeme gecheckt</span>
                    </div>
                </div>
            </div>

            <div className="px-3 py-2 border-b border-cyan-900/30 bg-black/20 grid grid-cols-4 gap-2 text-[11px]">
                <div className="border border-emerald-500/30 rounded p-2 text-emerald-200">OK: {summary?.passed ?? 0}</div>
                <div className="border border-amber-500/30 rounded p-2 text-amber-200">Warn: {summary?.warned ?? 0}</div>
                <div className="border border-red-500/30 rounded p-2 text-red-200">Fail: {summary?.failed ?? 0}</div>
                <div className="border border-cyan-700/40 rounded p-2 text-cyan-200">{summary?.duration_ms ?? 0} ms</div>
            </div>

            <div className="flex-1 overflow-auto scrollbar-hide p-3 space-y-2">
                {checks.length === 0 && (
                    <div className="text-xs text-cyan-400/70">Keine Check-Daten vorhanden.</div>
                )}
                {checks.map((check, idx) => (
                    <div key={`${check.name || 'check'}-${idx}`} className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                        <div className="flex items-start justify-between gap-2">
                            <div className="text-cyan-100/90 text-xs font-semibold">{check.name || 'Check'}</div>
                            <div className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${badgeClass(check.status)}`}>
                                {check.status || 'unknown'}
                            </div>
                        </div>
                        <div className="text-[11px] text-cyan-300/85 mt-1 break-words">{check.message || '-'}</div>
                        <div className="text-[10px] text-cyan-500/80 mt-1">Dauer: {check.duration_ms ?? 0} ms</div>
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
        if (payload.type === 'route') return 'route';
        if (payload.type === 'system_check') return 'system';
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
    if (payload?.type === 'route') content = <RouteView payload={payload} />;
    if (payload?.type === 'system_check') content = <SystemCheckView payload={payload} />;
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
