import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    CloudSun,
    CalendarDays,
    Mail,
    MessageCircle,
    Printer,
    Lightbulb,
    Gauge,
    Route,
    ShieldCheck,
    Brain,
    Cpu,
    Database,
    Wifi,
    Server,
    LineChart,
    ArrowUp,
    ArrowLeft,
    ArrowRight,
    CornerUpLeft,
    CornerUpRight,
    RotateCcw,
    Trash2,
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
        { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
        { id: 'route', label: 'Route', Icon: Route },
        { id: 'stock', label: 'Stock', Icon: LineChart },
        { id: 'system', label: 'System', Icon: ShieldCheck },
        { id: 'memory', label: 'Memory', Icon: Brain },
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

const WhatsappView = ({ payload }) => {
    const data = payload?.whatsapp || {};
    const chats = Array.isArray(data?.chats) ? data.chats : [];
    const openEmbeddedWeb = data?.openEmbeddedWeb === true;
    const webviewReloadKey = data?.webviewReloadKey || 'default';
    const unreadCount = Number.isFinite(Number(data?.unreadCount)) ? Number(data.unreadCount) : 0;
    const status = String(data?.status || 'unknown');
    const webviewRef = useRef(null);

    useEffect(() => {
        if (!openEmbeddedWeb || !webviewRef.current) return;

        const view = webviewRef.current;
        const applyZoom = () => {
            try {
                // Zoom out slightly so WhatsApp fits better without horizontal scrolling.
                view.setZoomFactor(0.76);
            } catch {
                // Ignore if webview API is temporarily unavailable.
            }
        };

        view.addEventListener('dom-ready', applyZoom);
        return () => {
            view.removeEventListener('dom-ready', applyZoom);
        };
    }, [openEmbeddedWeb, webviewReloadKey]);
    const statusLabel = status === 'connected'
        ? 'Connected'
        : status === 'login_required'
            ? 'Login Required'
            : status === 'disabled'
                ? 'Disabled'
                : 'Loading';

    const statusClass = status === 'connected'
        ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
        : status === 'login_required'
            ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
            : 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10';

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'WhatsApp Inbox'}</div>
                <div className="mt-1 flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${statusClass}`}>{statusLabel}</span>
                    <span className="text-[10px] text-cyan-200/80">Unread: {unreadCount}</span>
                </div>
                <div className="text-[10px] text-cyan-500/70 mt-1">
                    Last Update: {data?.timestamp ? formatTime(data.timestamp) : '-'}
                </div>
            </div>
            <div className={`flex-1 ${openEmbeddedWeb ? 'overflow-hidden p-0' : 'overflow-auto scrollbar-hide p-3 space-y-2'}`}>
                {openEmbeddedWeb && (
                    <div className="h-full w-full border-t border-cyan-900/30 bg-black/60 overflow-hidden">
                        <webview
                            ref={webviewRef}
                            key={String(webviewReloadKey)}
                            src="https://web.whatsapp.com"
                            partition="persist:whatsapp"
                            useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                            allowpopups="false"
                            style={{ width: '100%', height: '100%', border: '0', background: '#0b141a' }}
                        />
                    </div>
                )}
                {!openEmbeddedWeb && chats.length === 0 && unreadCount > 0 && (
                    <div className="text-xs text-cyan-400/70">
                        Ungelesene Nachrichten erkannt, aber Chat-Text konnte noch nicht geladen werden. Lass WhatsApp kurz aktiv und versuche es erneut.
                    </div>
                )}
                {!openEmbeddedWeb && chats.map((chat, idx) => (
                    <div key={`${chat.name || 'chat'}-${idx}`} className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                        <div className="flex items-start justify-between gap-2">
                            <div className="text-cyan-100/90 text-xs font-semibold truncate">{chat.name || 'Unknown'}</div>
                            {Number(chat.unread) > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                                    {chat.unread}
                                </span>
                            )}
                        </div>
                        {chat.meta && <div className="text-[10px] text-cyan-500/70 mt-1 truncate">{chat.meta}</div>}
                        {chat.preview && <div className="text-[11px] text-cyan-200/80 mt-1 line-clamp-2">{chat.preview}</div>}
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

const formatNumber = (value, digits = 2) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 'n/a';
    return num.toFixed(digits);
};

const formatSigned = (value, digits = 2) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 'n/a';
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(digits)}`;
};

const StockSparkline = ({ points = [] }) => {
    if (!Array.isArray(points) || points.length < 2) {
        return (
            <div className="h-32 rounded-lg border border-cyan-900/40 bg-black/30 flex items-center justify-center text-xs text-cyan-400/70">
                Nicht genug Daten fuer Graph.
            </div>
        );
    }

    const prices = points
        .map((p) => Number(p?.price))
        .filter((v) => Number.isFinite(v));

    if (prices.length < 2) {
        return (
            <div className="h-32 rounded-lg border border-cyan-900/40 bg-black/30 flex items-center justify-center text-xs text-cyan-400/70">
                Nicht genug Daten fuer Graph.
            </div>
        );
    }

    const width = 760;
    const height = 220;
    const padX = 14;
    const padY = 14;
    const minV = Math.min(...prices);
    const maxV = Math.max(...prices);
    const spread = Math.max(0.000001, maxV - minV);
    const usableW = width - (padX * 2);
    const usableH = height - (padY * 2);

    const toXY = (value, idx) => {
        const x = padX + (idx / (prices.length - 1)) * usableW;
        const y = padY + ((maxV - value) / spread) * usableH;
        return [x, y];
    };

    const coords = prices.map((v, i) => toXY(v, i));
    const linePath = coords
        .map((xy, idx) => `${idx === 0 ? 'M' : 'L'} ${xy[0].toFixed(2)} ${xy[1].toFixed(2)}`)
        .join(' ');
    const areaPath = `${linePath} L ${(padX + usableW).toFixed(2)} ${(padY + usableH).toFixed(2)} L ${padX.toFixed(2)} ${(padY + usableH).toFixed(2)} Z`;

    const first = prices[0];
    const last = prices[prices.length - 1];
    const up = last >= first;

    return (
        <div className="rounded-lg border border-cyan-900/40 bg-gradient-to-b from-cyan-950/20 to-black/35 p-2">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" role="img" aria-label="Stock Price Chart">
                <defs>
                    <linearGradient id="stockAreaGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={up ? '#34d399' : '#f87171'} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={up ? '#34d399' : '#f87171'} stopOpacity="0.03" />
                    </linearGradient>
                </defs>

                <path d={areaPath} fill="url(#stockAreaGrad)" />
                <path d={linePath} fill="none" stroke={up ? '#34d399' : '#f87171'} strokeWidth="3" strokeLinecap="round" />
                <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="4" fill={up ? '#34d399' : '#f87171'} />
            </svg>
        </div>
    );
};

const StockView = ({ payload }) => {
    const stock = payload?.stock || null;
    const quote = stock?.quote || {};
    const chart = stock?.chart || {};
    const chartPoints = Array.isArray(chart?.points) ? chart.points : [];
    const newsPayload = payload?.news || {};
    const newsItems = Array.isArray(newsPayload?.news) ? newsPayload.news : [];

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'Stock Detail'}</div>
                {stock && (
                    <>
                        <div className="text-cyan-100 text-base mt-1 font-semibold">
                            {stock?.name || stock?.symbol} ({stock?.symbol || '-'})
                        </div>
                        <div className="text-cyan-100/80 text-xs mt-1">
                            {stock?.exchange || '-'} | {stock?.currency || '-'}
                        </div>
                    </>
                )}
            </div>

            {stock && (
                <div className="px-3 py-2 border-b border-cyan-900/30 bg-black/20 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="border border-cyan-700/40 rounded p-2 text-cyan-100">Preis: {formatNumber(quote?.current)}</div>
                    <div className="border border-cyan-700/40 rounded p-2 text-cyan-100">Aend.: {formatSigned(quote?.change)} ({formatSigned(quote?.percent_change)}%)</div>
                    <div className="border border-cyan-700/40 rounded p-2 text-cyan-100">High: {formatNumber(quote?.high)}</div>
                    <div className="border border-cyan-700/40 rounded p-2 text-cyan-100">Low: {formatNumber(quote?.low)}</div>
                </div>
            )}

            {stock && (
                <div className="px-3 py-2 border-b border-cyan-900/30 bg-black/15">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-cyan-300 text-[11px] uppercase tracking-wider font-semibold">Kursverlauf</div>
                        <div className="text-cyan-500/80 text-[10px] uppercase tracking-wider">
                            {chart?.range || 'range n/a'} | {chart?.resolution || 'res n/a'}
                        </div>
                    </div>
                    <StockSparkline points={chartPoints} />
                </div>
            )}

            <div className="flex-1 overflow-auto scrollbar-hide p-3 space-y-2">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-semibold">News</div>
                {newsItems.length === 0 && (
                    <div className="text-xs text-cyan-400/70">Keine News im aktuellen Datensatz.</div>
                )}
                {newsItems.map((item, idx) => (
                    <div key={`${idx}-${item.headline || ''}`} className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                        <div className="text-cyan-100/90 text-xs font-semibold">{item.headline || 'Ohne Titel'}</div>
                        <div className="text-[11px] text-cyan-400/80 mt-1">
                            {(item.source || 'Unbekannte Quelle')} | {formatTime(item.datetime_iso || item.datetime_unix)}
                        </div>
                        {item.summary && (
                            <div className="text-[11px] text-cyan-200/80 mt-1 line-clamp-4">{item.summary}</div>
                        )}
                        {item.url && (
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block mt-2 text-[11px] text-cyan-300 underline"
                            >
                                Quelle oeffnen
                            </a>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const SystemCheckView = ({ payload, variant = 'default', meshOnly = false, showMesh = true }) => {
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

    const normalizeStatus = (status, idx) => {
        const known = ['pass', 'warn', 'fail'];
        if (known.includes(status)) return status;
        if (isRunning && idx >= completedChecks) return 'pending';
        return 'warn';
    };

    const statusDotClass = (status) => {
        if (status === 'warn') return 'bg-amber-300/80 shadow-[0_0_6px_rgba(251,191,36,0.45)]';
        if (status === 'fail') return 'bg-red-300/85 shadow-[0_0_6px_rgba(248,113,113,0.5)]';
        return 'bg-cyan-400/70 shadow-[0_0_10px_rgba(34,211,238,0.6)]';
    };

    const statusIconClass = (status) => {
        if (status === 'warn') return 'text-amber-300';
        if (status === 'fail') return 'text-red-300';
        if (status === 'pass') return 'text-emerald-300';
        return 'text-cyan-100/90';
    };

    const nodeIcon = (name) => {
        const text = String(name || '').toLowerCase();

        // Core checks
        if (text.includes('model') || text.includes('session')) return Cpu;
        if (text.includes('project') || text.includes('storage')) return Database;
        if (text.includes('long-term memory') || text === 'memory' || text.includes('memory')) return Database;

        // Smart home
        if (text.includes('smart home cache')) return Lightbulb;
        if (text.includes('smart home discovery')) return Wifi;

        // External services
        if (text.includes('printer')) return Printer;
        if (text.includes('whatsapp')) return MessageCircle;
        if (text.includes('weather')) return CloudSun;
        if (text.includes('stock')) return LineChart;
        if (text.includes('route')) return Route;
        if (text.includes('google calendar') || text.includes('calendar')) return CalendarDays;
        if (text.includes('gmail') || text.includes('mail')) return Mail;
        if (text.includes('network checks')) return Gauge;

        // Generic cloud/integration fallback
        if (text.includes('google') || text.includes('api') || text.includes('service')) return Server;
        return ShieldCheck;
    };

    const isHero = variant === 'hero';

    const visibleChecks = checks;
    const nodeCount = Math.max(visibleChecks.length, 1);
    const orbitRadiusX = isHero ? 41 : 40;
    const orbitRadiusY = isHero ? 36 : 34;

    const nodes = visibleChecks.map((check, idx) => {
        const angle = (-Math.PI / 2) + ((idx / nodeCount) * Math.PI * 2);
        const pos = {
            x: 50 + (Math.cos(angle) * orbitRadiusX),
            y: 50 + (Math.sin(angle) * orbitRadiusY),
        };
        return {
            id: `${check?.name || 'check'}-${idx}`,
            name: check?.name || `Check ${idx + 1}`,
            status: normalizeStatus(check?.status, idx),
            message: check?.message || '-',
            x: pos.x,
            y: pos.y,
            Icon: nodeIcon(check?.name),
            delay: idx * 0.16,
        };
    });

    const coreNode = {
        x: 50,
        y: 50,
        id: 'core',
    };

    const ringLinks = nodes.map((node, idx) => {
        const next = nodes[(idx + 1) % nodes.length];
        return {
            id: `${node.id}-ring-${idx}`,
            from: node,
            to: next,
            status: node.status,
        };
    });

    const statusLinks = nodes
        .filter((node) => node.status === 'warn' || node.status === 'fail')
        .map((node, idx) => ({
            id: `${node.id}-status-${idx}`,
            from: node,
            to: coreNode,
            status: node.status,
        }));

    const linkStrokeClass = (status) => {
        if (status === 'pass') return 'stroke-emerald-400/45';
        if (status === 'warn') return 'stroke-amber-400/45';
        if (status === 'fail') return 'stroke-red-400/45';
        return 'stroke-cyan-400/35';
    };

    const meshSection = (
        <div className="px-3 py-3 border-b border-cyan-900/30 bg-gradient-to-b from-cyan-950/20 to-black/25 overflow-hidden">
            <div className="text-cyan-300 text-[11px] uppercase tracking-wider font-semibold mb-2">System Mesh</div>
            <div className={`relative ${isHero ? 'h-64' : 'h-52'} rounded-xl border border-cyan-900/40 bg-black/40 overflow-hidden animate-shimmer-border`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_45%),radial-gradient(circle_at_78%_70%,rgba(20,184,166,0.12),transparent_42%)]" />

                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="System Check Network Graph">
                    {ringLinks.map((link, idx) => (
                        <line
                            key={link.id}
                            x1={link.from.x}
                            y1={link.from.y}
                            x2={link.to.x}
                            y2={link.to.y}
                            className="stroke-cyan-500/30 animate-data-flow"
                            strokeWidth="0.35"
                            strokeDasharray="1.8 1.4"
                            style={{ animationDelay: `${idx * 0.09}s` }}
                        />
                    ))}
                    {statusLinks.map((link, idx) => (
                        <line
                            key={link.id}
                            x1={link.from.x}
                            y1={link.from.y}
                            x2={link.to.x}
                            y2={link.to.y}
                            className={`${linkStrokeClass(link.status)} animate-data-flow`}
                            strokeWidth="0.45"
                            strokeDasharray="2.2 1.4"
                            style={{ animationDelay: `${idx * 0.14}s` }}
                        />
                    ))}
                    {nodes.map((node, idx) => {
                        if (node.status === 'warn' || node.status === 'fail') {
                            return null;
                        }
                        return (
                            <line
                                key={`${node.id}-core`}
                                x1={coreNode.x}
                                y1={coreNode.y}
                                x2={node.x}
                                y2={node.y}
                                className="stroke-cyan-500/20 animate-data-flow"
                                strokeWidth="0.35"
                                strokeDasharray="1.5 1.2"
                                style={{ animationDelay: `${idx * 0.11}s` }}
                            />
                        );
                    })}
                </svg>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className={`relative ${isHero ? 'w-14 h-14' : 'w-10 h-10'} rounded-full flex items-center justify-center`}>
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
                            <circle cx="50" cy="50" r="44" fill="rgba(34,211,238,0.08)" stroke="rgba(103,232,249,0.75)" strokeWidth="4" />
                            <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2" />
                        </svg>
                        <div className="absolute inset-0 rounded-full animate-node-pulse" />
                        <ShieldCheck size={isHero ? 18 : 16} className="text-cyan-200 relative z-10" />
                    </div>
                </div>

                {nodes.map((node) => {
                    const Icon = node.Icon;
                    return (
                        <div
                            key={node.id}
                            className="absolute z-20"
                            style={{
                                left: `${node.x}%`,
                                top: `${node.y}%`,
                                transform: 'translate(-50%, -50%)',
                                animationDelay: `${node.delay}s`,
                            }}
                        >
                            <div className="relative group animate-float-node">
                                <div className={`${isHero ? 'w-9 h-9' : 'w-8 h-8'} rounded-full border border-cyan-700/40 bg-black/70 backdrop-blur flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${node.status === 'pending' ? 'opacity-80' : 'opacity-100'}`}>
                                    <Icon size={isHero ? 15 : 14} className={statusIconClass(node.status)} />
                                </div>
                                {(node.status === 'warn' || node.status === 'fail') && (
                                    <span className={`absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full ${statusDotClass(node.status)}`} />
                                )}

                                <div className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded border border-cyan-700/40 bg-black/80 px-2 py-1 text-[10px] text-cyan-200 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                    {node.name}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    if (meshOnly) {
        return (
            <div className="h-full w-full p-3">
                {meshSection}
            </div>
        );
    }

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

            {showMesh && meshSection}

            <div className="flex-1 overflow-auto scrollbar-hide p-3 space-y-2">
                {checks.length === 0 && (
                    <div className="text-xs text-cyan-400/70">Keine Check-Daten vorhanden.</div>
                )}
                {checks.map((check, idx) => (
                    <div
                        key={`${check.name || 'check'}-${idx}`}
                        className="border border-cyan-900/40 rounded-lg p-2 bg-black/35 animate-fade-in-up"
                        style={{ animationDelay: `${Math.min(idx * 0.05, 0.35)}s` }}
                    >
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

const MemoryQualityView = ({
    payload,
    meshOnly = false,
    showMesh = true,
    selectedRoomFilter = null,
    onRoomSelect = null,
    onClearRoomFilter = null,
}) => {
    const report = payload?.report || {};
    const quality = report?.quality || {};
    const policy = report?.policy_stats || {};

    const byWing = Array.isArray(quality?.by_wing) ? quality.by_wing : [];
    const byType = Array.isArray(quality?.by_type) ? quality.by_type : [];
    const roomDetails = Array.isArray(quality?.room_details) ? quality.room_details : [];
    const roomLinks = Array.isArray(quality?.room_links) ? quality.room_links : [];

    const [meshLayer, setMeshLayer] = useState('rooms');
    const [zoom, setZoom] = useState(meshOnly ? 1.08 : 1.0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    const avgConfidence = Number.isFinite(Number(quality?.avg_confidence)) ? Number(quality.avg_confidence) : 0;
    const noiseRatio = Number.isFinite(Number(quality?.noise_ratio)) ? Number(quality.noise_ratio) : 0;
    const duplicateRatio = Number.isFinite(Number(quality?.duplicate_ratio)) ? Number(quality.duplicate_ratio) : 0;
    const sampledEntries = Number.isFinite(Number(quality?.sampled_entries)) ? Number(quality.sampled_entries) : 0;

    const healthScore = Math.max(
        0,
        Math.min(1, avgConfidence - (noiseRatio * 0.55) - (duplicateRatio * 0.65))
    );

    const healthLabel = healthScore >= 0.75
        ? 'Excellent'
        : healthScore >= 0.55
            ? 'Stable'
            : healthScore >= 0.35
                ? 'Needs tuning'
                : 'Critical';

    const healthClass = healthScore >= 0.75
        ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
        : healthScore >= 0.55
            ? 'text-cyan-200 border-cyan-500/40 bg-cyan-500/10'
            : healthScore >= 0.35
                ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                : 'text-red-300 border-red-500/40 bg-red-500/10';

    const baseNodes = useMemo(() => {
        if (meshLayer === 'wings') {
            const wingNodes = byWing.slice(0, 10).map((item) => ({
                id: `wing-${item?.name || 'unknown'}`,
                label: String(item?.name || 'wing'),
                room: null,
                count: Number(item?.count || 0),
                types: [],
                samples: [],
                kind: 'wing',
            }));
            return wingNodes.length ? wingNodes : [{ id: 'wing-fallback', label: report?.current_wing || 'default', room: null, count: sampledEntries || 1, types: [], samples: [], kind: 'wing' }];
        }

        if (meshLayer === 'types') {
            const typeNodes = byType.slice(0, 12).map((item) => ({
                id: `type-${item?.name || 'unknown'}`,
                label: String(item?.name || 'type'),
                room: null,
                count: Number(item?.count || 0),
                types: [{ name: String(item?.name || 'type'), count: Number(item?.count || 0) }],
                samples: [],
                kind: 'type',
            }));
            return typeNodes.length ? typeNodes : [{ id: 'type-fallback', label: 'note', room: null, count: sampledEntries || 1, types: [{ name: 'note', count: sampledEntries || 1 }], samples: [], kind: 'type' }];
        }

        const roomNodes = roomDetails.slice(0, 14).map((item) => ({
            id: `room-${item?.room || 'unknown'}`,
            label: String(item?.room || 'room'),
            room: String(item?.room || 'room'),
            count: Number(item?.count || 0),
            types: Array.isArray(item?.types) ? item.types : [],
            samples: Array.isArray(item?.samples) ? item.samples : [],
            kind: 'room',
        }));
        return roomNodes.length ? roomNodes : [{ id: 'room-fallback', label: 'general', room: 'general', count: sampledEntries || 1, types: [], samples: [], kind: 'room' }];
    }, [meshLayer, byWing, byType, roomDetails, report?.current_wing, sampledEntries]);

    const meshNodes = useMemo(() => {
        const radiusX = meshLayer === 'wings' ? 34 : 41;
        const radiusY = meshLayer === 'wings' ? 28 : 34;
        return baseNodes.map((seed, idx) => {
            const angle = (-Math.PI / 2) + ((idx / baseNodes.length) * Math.PI * 2);
            return {
                ...seed,
                x: 50 + (Math.cos(angle) * radiusX),
                y: 50 + (Math.sin(angle) * radiusY),
                delay: idx * 0.12,
            };
        });
    }, [baseNodes, meshLayer]);

    const ringLinks = useMemo(() => meshNodes.map((node, idx) => ({
        id: `${node.id}-ring-${idx}`,
        from: node,
        to: meshNodes[(idx + 1) % meshNodes.length],
    })), [meshNodes]);

    const graphLinks = useMemo(() => {
        if (meshLayer === 'rooms') {
            const roomMap = new Map(meshNodes.map((node) => [node.room, node]));
            return roomLinks
                .map((link, idx) => {
                    const from = roomMap.get(String(link?.source || ''));
                    const to = roomMap.get(String(link?.target || ''));
                    if (!from || !to) return null;
                    return {
                        id: `room-link-${idx}-${from.id}-${to.id}`,
                        from,
                        to,
                        weight: Number(link?.weight || 1),
                    };
                })
                .filter(Boolean)
                .slice(0, 32);
        }

        if (meshLayer === 'types') {
            const pairMap = {};
            roomDetails.forEach((room) => {
                const types = (Array.isArray(room?.types) ? room.types : []).map((t) => String(t?.name || '')).filter(Boolean);
                for (let i = 0; i < types.length; i++) {
                    for (let j = i + 1; j < types.length; j++) {
                        const key = [types[i], types[j]].sort().join('|');
                        pairMap[key] = (pairMap[key] || 0) + 1;
                    }
                }
            });
            const nodeMap = new Map(meshNodes.map((node) => [node.label, node]));
            return Object.entries(pairMap)
                .sort((a, b) => b[1] - a[1])
                .map(([key, weight], idx) => {
                    const [left, right] = key.split('|');
                    const from = nodeMap.get(left);
                    const to = nodeMap.get(right);
                    if (!from || !to) return null;
                    return {
                        id: `type-link-${idx}-${from.id}-${to.id}`,
                        from,
                        to,
                        weight,
                    };
                })
                .filter(Boolean)
                .slice(0, 28);
        }

        return [];
    }, [meshLayer, meshNodes, roomLinks, roomDetails]);

    const nodeClass = (node) => {
        if (node.kind === 'wing') return 'text-blue-200 border-blue-500/40 bg-blue-500/12';
        if (node.kind === 'type') return 'text-amber-300 border-amber-500/40 bg-amber-500/12';

        const topType = String(node?.types?.[0]?.name || '').toLowerCase();
        if (topType.includes('decision')) return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/12';
        if (topType.includes('task')) return 'text-amber-300 border-amber-500/40 bg-amber-500/12';
        if (topType.includes('preference')) return 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/12';
        if (topType.includes('fact')) return 'text-cyan-200 border-cyan-500/40 bg-cyan-500/12';
        return 'text-cyan-100 border-cyan-700/40 bg-cyan-500/10';
    };

    const handleWheel = (event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.08 : 0.08;
        setZoom((prev) => Math.max(0.7, Math.min(2.2, prev + delta)));
    };

    const handlePanStart = (event) => {
        setIsPanning(true);
        panStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
        };
    };

    const handlePanMove = (event) => {
        if (!isPanning) return;
        const dx = event.clientX - panStartRef.current.x;
        const dy = event.clientY - panStartRef.current.y;
        setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    };

    const handlePanEnd = () => {
        setIsPanning(false);
    };

    const activeRoomDetail = selectedRoomFilter
        ? roomDetails.find((item) => String(item?.room || '') === String(selectedRoomFilter)) || null
        : null;

    const displayRoomRows = activeRoomDetail ? [activeRoomDetail] : roomDetails.slice(0, 14);
    const displayTypeRows = activeRoomDetail
        ? (Array.isArray(activeRoomDetail?.types) ? activeRoomDetail.types : [])
        : byType;

    const meshSection = (
        <div className="px-3 py-3 border-b border-cyan-900/30 bg-gradient-to-b from-cyan-950/20 to-black/25 overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-cyan-300 text-[11px] uppercase tracking-wider font-semibold">Memory Mesh</div>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${healthClass}`}>Health: {healthLabel}</span>
            </div>

            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex gap-1">
                    {['wings', 'rooms', 'types'].map((layer) => {
                        const active = meshLayer === layer;
                        return (
                            <button
                                key={layer}
                                onClick={() => setMeshLayer(layer)}
                                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${active ? 'border-cyan-400 bg-cyan-900/25 text-cyan-200' : 'border-cyan-900/50 bg-black/30 text-cyan-500/80 hover:border-cyan-700/70'}`}
                            >
                                {layer}
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => {
                        setZoom(meshOnly ? 1.08 : 1.0);
                        setPan({ x: 0, y: 0 });
                    }}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-cyan-900/50 bg-black/30 text-cyan-400/85 hover:border-cyan-700/70"
                >
                    reset view
                </button>
            </div>

            <div
                className={`relative h-64 rounded-xl border border-cyan-900/40 bg-black/40 overflow-hidden animate-shimmer-border ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                onWheel={handleWheel}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.12),transparent_44%),radial-gradient(circle_at_78%_72%,rgba(251,191,36,0.1),transparent_42%)]" />

                <div
                    className="absolute inset-0 transition-transform duration-75"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: '50% 50%',
                    }}
                >
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Memory Quality Mesh">
                        {ringLinks.map((link, idx) => (
                            <line
                                key={link.id}
                                x1={link.from.x}
                                y1={link.from.y}
                                x2={link.to.x}
                                y2={link.to.y}
                                className="stroke-cyan-500/22 animate-data-flow"
                                strokeWidth="0.22"
                                strokeDasharray="1.7 1.4"
                                style={{ animationDelay: `${idx * 0.08}s` }}
                            />
                        ))}

                        {graphLinks.map((link, idx) => (
                            <line
                                key={link.id}
                                x1={link.from.x}
                                y1={link.from.y}
                                x2={link.to.x}
                                y2={link.to.y}
                                className="stroke-cyan-400/42 animate-data-flow"
                                strokeWidth={Math.min(0.18 + (Number(link.weight || 1) * 0.08), 0.85)}
                                strokeDasharray="2.2 1.3"
                                style={{ animationDelay: `${idx * 0.06}s` }}
                            />
                        ))}

                        {meshNodes.map((node, idx) => (
                            <line
                                key={`${node.id}-core`}
                                x1="50"
                                y1="50"
                                x2={node.x}
                                y2={node.y}
                                className="stroke-cyan-500/18 animate-data-flow"
                                strokeWidth="0.28"
                                strokeDasharray="1.6 1.2"
                                style={{ animationDelay: `${idx * 0.11}s` }}
                            />
                        ))}
                    </svg>

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className="relative w-14 h-14 rounded-full flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
                                <circle cx="50" cy="50" r="44" fill="rgba(34,211,238,0.08)" stroke="rgba(103,232,249,0.65)" strokeWidth="4" />
                                <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="2" />
                            </svg>
                            <div className="absolute inset-0 rounded-full animate-node-pulse" />
                            <Brain size={18} className="text-cyan-100 relative z-10" />
                        </div>
                    </div>

                    {meshNodes.map((node) => {
                        const isSelectedRoom = node.kind === 'room' && selectedRoomFilter && node.room === selectedRoomFilter;
                        return (
                            <div
                                key={node.id}
                                className="absolute z-20"
                                style={{
                                    left: `${node.x}%`,
                                    top: `${node.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                <div className="relative group animate-float-node" style={{ animationDelay: `${node.delay}s` }}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (node.kind === 'room' && onRoomSelect) {
                                                onRoomSelect(node.room);
                                            }
                                        }}
                                        className={`w-10 h-10 rounded-full border backdrop-blur flex items-center justify-center ${nodeClass(node)} ${isSelectedRoom ? 'ring-2 ring-white/70' : ''}`}
                                        title={node.label}
                                    >
                                        <span className="text-[10px] font-semibold">{Math.min(node.count, 99)}</span>
                                    </button>
                                    <div className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded border border-cyan-700/40 bg-black/85 px-2 py-1 text-[10px] text-cyan-200 opacity-0 transition-opacity duration-200 group-hover:opacity-100 max-w-[240px] overflow-hidden text-ellipsis">
                                        <div className="font-semibold">{node.label}</div>
                                        {node.types.slice(0, 2).map((t) => (
                                            <div key={`${node.id}-${t?.name}`} className="text-cyan-300/80">{t?.name}: {t?.count}</div>
                                        ))}
                                        {node.samples?.[0] && <div className="text-cyan-500/80 mt-0.5">{node.samples[0]}</div>}
                                        {node.kind === 'room' && <div className="text-[9px] text-cyan-400/70 mt-0.5">click to filter left panel</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                <div className="border border-cyan-800/40 rounded px-2 py-1 bg-black/30 text-cyan-200/85">
                    Confidence {(avgConfidence * 100).toFixed(1)}%
                </div>
                <div className="border border-amber-700/40 rounded px-2 py-1 bg-black/30 text-amber-200/85">
                    Noise {(noiseRatio * 100).toFixed(1)}%
                </div>
                <div className="border border-red-700/40 rounded px-2 py-1 bg-black/30 text-red-200/85">
                    Dupes {(duplicateRatio * 100).toFixed(1)}%
                </div>
            </div>
        </div>
    );

    if (meshOnly) {
        return (
            <div className="h-full w-full p-3">
                {meshSection}
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-black/30">
                <div className="text-cyan-300 text-xs uppercase tracking-wider font-bold">{payload?.title || 'Memory Quality'}</div>
                <div className="text-cyan-100/75 text-xs mt-1">Project: {report?.current_project || '-'}</div>
                <div className="text-cyan-100/75 text-xs">Wing: {report?.current_wing || '-'}</div>
                {report?.message && <div className="text-[11px] text-cyan-300/80 mt-1">{report.message}</div>}
                {selectedRoomFilter && (
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-200">
                            Room filter: {selectedRoomFilter}
                        </span>
                        {onClearRoomFilter && (
                            <button
                                onClick={onClearRoomFilter}
                                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-cyan-900/50 bg-black/30 text-cyan-300 hover:border-cyan-700/70"
                            >
                                clear filter
                            </button>
                        )}
                    </div>
                )}
            </div>

            {showMesh && meshSection}

            <div className="px-3 py-2 border-b border-cyan-900/30 bg-black/20 grid grid-cols-2 gap-2 text-[11px]">
                <div className="border border-cyan-700/40 rounded p-2 text-cyan-100">Total: {report?.total_entries ?? 0}</div>
                <div className="border border-cyan-700/40 rounded p-2 text-cyan-100">Sample: {quality?.sampled_entries ?? 0}</div>
                <div className="border border-emerald-500/30 rounded p-2 text-emerald-200">Avg conf: {(avgConfidence * 100).toFixed(1)}%</div>
                <div className="border border-amber-500/30 rounded p-2 text-amber-200">Noise: {(noiseRatio * 100).toFixed(1)}%</div>
                <div className="border border-red-500/30 rounded p-2 text-red-200">Dupes: {(duplicateRatio * 100).toFixed(1)}%</div>
                <div className="border border-cyan-700/40 rounded p-2 text-cyan-200">Long: {quality?.long_entries ?? 0}</div>
            </div>

            <div className="flex-1 overflow-auto scrollbar-hide p-3 space-y-3">
                <div className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                    <div className="text-cyan-300 text-xs uppercase tracking-wider font-semibold mb-2">Policy Stats (session)</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="text-cyan-100/90">Saved: {policy?.saved ?? 0}</div>
                        <div className="text-cyan-100/90">Filtered: {policy?.filtered ?? 0}</div>
                        <div className="text-cyan-100/90">Duplicates: {policy?.duplicates ?? 0}</div>
                        <div className="text-cyan-100/90">Manual saved: {policy?.manual_saved ?? 0}</div>
                    </div>
                </div>

                <div className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                    <div className="text-cyan-300 text-xs uppercase tracking-wider font-semibold mb-2">Rooms</div>
                    {displayRoomRows.length === 0 && <div className="text-[11px] text-cyan-400/70">No room data.</div>}
                    {displayRoomRows.map((item) => (
                        <div key={`room-${item?.room}`} className="py-1 border-b border-cyan-900/25 last:border-b-0">
                            <div className="flex items-center justify-between text-[11px] text-cyan-100/90">
                                <span>{item?.room || 'unknown'}</span>
                                <span>{item?.count ?? 0}</span>
                            </div>
                            {Array.isArray(item?.types) && item.types.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {item.types.slice(0, 3).map((t) => (
                                        <span key={`${item?.room}-${t?.name}`} className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-800/40 bg-black/30 text-cyan-300/85">
                                            {t?.name}: {t?.count}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="border border-cyan-900/40 rounded-lg p-2 bg-black/35">
                    <div className="text-cyan-300 text-xs uppercase tracking-wider font-semibold mb-2">Memory Types</div>
                    {displayTypeRows.length === 0 && <div className="text-[11px] text-cyan-400/70">No type data.</div>}
                    {displayTypeRows.map((item) => (
                        <div key={`type-${item?.name}`} className="flex items-center justify-between text-[11px] text-cyan-100/90 py-0.5">
                            <span>{item?.name || 'unknown'}</span>
                            <span>{item?.count ?? 0}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const LeftToolView = ({
    payload,
    onClear,
    variant = 'default',
    selectedRoomFilter = null,
    onRoomSelect = null,
    onClearRoomFilter = null,
}) => {
    const [fadeKey, setFadeKey] = useState(0);
    const isEmpty = !payload?.type || payload.type === 'clear';

    const mode = useMemo(() => {
        if (!payload?.type || payload.type === 'clear') return 'none';
        if (payload.type === 'weather') return 'weather';
        if (payload.type === 'calendar') return 'calendar';
        if (payload.type === 'email' || payload.type === 'email_list') return 'mail';
        if (payload.type === 'whatsapp') return 'whatsapp';
        if (payload.type === 'route') return 'route';
        if (payload.type === 'stock') return 'stock';
        if (payload.type === 'system_check') return 'system';
        if (payload.type === 'memory_quality') return 'memory';
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
    if (payload?.type === 'whatsapp') content = <WhatsappView payload={payload} />;
    if (payload?.type === 'route') content = <RouteView payload={payload} />;
    if (payload?.type === 'stock') content = <StockView payload={payload} />;
    if (payload?.type === 'system_check') {
        const isSystemHero = variant === 'system-hero';
        const isSystemNoMesh = variant === 'system-no-mesh';
        content = <SystemCheckView payload={payload} variant={isSystemHero ? 'hero' : 'default'} meshOnly={isSystemHero} showMesh={!isSystemNoMesh} />;
    }
    if (payload?.type === 'memory_quality') {
        const isMemoryHero = variant === 'memory-hero';
        const isMemoryNoMesh = variant === 'memory-no-mesh';
        content = (
            <MemoryQualityView
                payload={payload}
                meshOnly={isMemoryHero}
                showMesh={!isMemoryNoMesh}
                selectedRoomFilter={selectedRoomFilter}
                onRoomSelect={onRoomSelect}
                onClearRoomFilter={onClearRoomFilter}
            />
        );
    }
    if (payload?.type === 'clear') content = <EmptyState />;

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            <div className="h-9 border-b border-cyan-900/40 bg-black/45 px-3 flex items-center justify-between">
                <span className="text-cyan-200 text-xs tracking-[0.25em] uppercase font-semibold">Detail View</span>
                <div className="flex items-center gap-2">
                    {onClear && (
                        <button
                            onClick={onClear}
                            disabled={isEmpty}
                            className="h-6 px-2 rounded border border-cyan-800/50 bg-black/40 text-cyan-300/85 hover:border-cyan-500/70 hover:text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-[10px] uppercase tracking-wider"
                            title="Clear Detail View"
                        >
                            <Trash2 size={11} />
                            Clear
                        </button>
                    )}
                    <span className="text-cyan-500/70 text-[10px] uppercase tracking-wider">Live</span>
                </div>
            </div>
            <ModeHeader activeMode={mode} />
            <div key={fadeKey} className="flex-1 animate-fade-in overflow-hidden">
                {content}
            </div>
        </div>
    );
};

export default LeftToolView;
export const SystemCheckMatrix = ({ payload, variant = 'hero' }) => (
    <SystemCheckView payload={payload} variant={variant} meshOnly />
);
export const MemoryQualityMatrix = ({
    payload,
    variant = 'hero',
    selectedRoomFilter = null,
    onRoomSelect = null,
    onClearRoomFilter = null,
}) => (
    <MemoryQualityView
        payload={payload}
        meshOnly
        showMesh={variant !== 'no-mesh'}
        selectedRoomFilter={selectedRoomFilter}
        onRoomSelect={onRoomSelect}
        onClearRoomFilter={onClearRoomFilter}
    />
);
