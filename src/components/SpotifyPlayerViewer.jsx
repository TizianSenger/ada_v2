import React, { useMemo } from 'react';
import { Disc3, Heart, Repeat, Shuffle } from 'lucide-react';

const formatMs = (value) => {
    const ms = Number(value);
    if (!Number.isFinite(ms) || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
};

const SpotifyPlayerViewer = ({ playerState, onAddToFavorites }) => {
    const state = playerState && typeof playerState === 'object' ? playerState : {};
    const track = state.track || {};
    const nextTracks = Array.isArray(state.next_tracks) ? state.next_tracks.slice(0, 2) : [];
    const durationMs = Number(track.duration_ms || 0);
    const progressMs = Number(state.progress_ms || 0);
    const progressPct = durationMs > 0 ? Math.max(0, Math.min(100, (progressMs / durationMs) * 100)) : 0;

    const subtitle = useMemo(() => {
        const artists = Array.isArray(track.artists) ? track.artists.filter(Boolean) : [];
        if (!artists.length) return 'Unknown artist';
        return artists.join(', ');
    }, [track.artists]);

    const repeatState = String(state.repeat_state || 'off');
    const shuffleEnabled = Boolean(state.shuffle_state);
    const trackAvailable = Boolean(track.id);

    return (
        <div className="w-[min(860px,94vw)] rounded-2xl border border-cyan-500/30 bg-black/60 backdrop-blur-xl shadow-[0_0_34px_rgba(34,211,238,0.2)] overflow-hidden pointer-events-auto animate-fade-in premium-spotify-shell">
            <div className="px-4 py-3 border-b border-cyan-900/40 bg-gradient-to-r from-cyan-950/45 via-black/55 to-black/45 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 text-cyan-200">
                    <Disc3 size={14} className="text-cyan-300 spotify-disc-spin" />
                    <span className="text-[11px] uppercase tracking-[0.2em] font-semibold">Spotify Live Player</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-cyan-300/85 flex-wrap">
                    <span className={`px-2 py-0.5 rounded border ${shuffleEnabled ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200' : 'border-cyan-900/60 bg-black/30 text-cyan-500/70'}`}>
                        <Shuffle size={11} className="inline mr-1" />
                        Shuffle: {shuffleEnabled ? 'On' : 'Off'}
                    </span>
                    <span className={`px-2 py-0.5 rounded border ${repeatState !== 'off' ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200' : 'border-cyan-900/60 bg-black/30 text-cyan-500/70'}`}>
                        <Repeat size={11} className="inline mr-1" />
                        Repeat: {repeatState}
                    </span>
                </div>
            </div>

            <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-[120px_1.35fr_1fr] gap-3 sm:gap-4 items-start">
                <div className="rounded-xl border border-cyan-900/45 bg-gradient-to-br from-cyan-950/20 to-black/40 p-2 flex items-center justify-center min-h-[120px] premium-spotify-card">
                    {track.image_url ? (
                        <img src={track.image_url} alt="cover" className="w-[108px] h-[108px] rounded-lg object-cover shadow-[0_0_18px_rgba(34,211,238,0.2)]" />
                    ) : (
                        <div className="w-[110px] h-[110px] rounded-lg border border-cyan-900/50 bg-black/40 flex items-center justify-center text-cyan-500/60 text-xs">
                            No Cover
                        </div>
                    )}
                </div>

                <div className="premium-spotify-card rounded-xl border border-cyan-900/45 bg-gradient-to-br from-cyan-950/14 to-black/35 p-3">
                    <div className="text-cyan-100 text-sm sm:text-[15px] font-semibold leading-snug truncate">{track.name || 'No active track'}</div>
                    <div className="text-cyan-300/85 text-xs mt-1 truncate">{subtitle}</div>
                    <div className="text-cyan-500/80 text-[11px] mt-1 truncate">Album: {track.album || 'n/a'}</div>
                    <div className="mt-3">
                        <div className="spotify-progress-rail h-2 rounded-full border border-cyan-900/50 bg-cyan-950/50 overflow-hidden">
                            <div className="spotify-progress-fill h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-cyan-300/80">
                            <span>{formatMs(progressMs)}</span>
                            <span>{formatMs(durationMs)}</span>
                        </div>
                    </div>
                    <button
                        onClick={onAddToFavorites}
                        disabled={Boolean(state.track_is_favorite) || !trackAvailable}
                        className="mt-3 text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-cyan-700/50 bg-black/35 text-cyan-200 hover:border-cyan-400/70 hover:shadow-[0_0_12px_rgba(34,211,238,0.24)] transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                        <Heart size={11} className="inline mr-1" />
                        {state.track_is_favorite ? 'Already in Favorites' : 'Add to Favorites'}
                    </button>
                </div>

                <div className="rounded-xl border border-cyan-900/45 bg-gradient-to-br from-cyan-950/14 to-black/35 p-2.5 premium-spotify-card">
                    <div className="text-cyan-300 text-[10px] uppercase tracking-wider font-semibold mb-2">Up Next</div>
                    <div className="space-y-2">
                        {nextTracks.length === 0 && (
                            <div className="text-[11px] text-cyan-500/70">No queue data available.</div>
                        )}
                        {nextTracks.map((row, idx) => (
                            <div key={`${row.id || row.uri || idx}`} className="text-[11px] border border-cyan-900/35 rounded p-2 bg-black/30 hover:bg-cyan-950/20 transition-colors duration-200">
                                <div className="text-cyan-100/90 truncate">{idx + 1}. {row.name || 'Unknown'}</div>
                                <div className="text-cyan-400/80 truncate mt-0.5">{Array.isArray(row.artists) ? row.artists.join(', ') : 'n/a'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpotifyPlayerViewer;
