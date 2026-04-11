import React, { useMemo } from 'react';
import { Disc3, Heart, Repeat, Shuffle, SkipBack, SkipForward } from 'lucide-react';

const formatMs = (value) => {
    const ms = Number(value);
    if (!Number.isFinite(ms) || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
};

const SpotifyPlayerViewer = ({
    playerState,
    onAddToFavorites,
    onRemoveFromFavorites,
    onNext,
    onPrevious,
    onToggleShuffle,
    onCycleRepeat,
}) => {
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
    const isPlaying = Boolean(state.is_playing);
    const isFavorite = Boolean(state.track_is_favorite);

    return (
        <div className="w-[min(640px,92vw)] rounded-2xl border border-cyan-500/25 bg-black/58 backdrop-blur-xl shadow-[0_0_24px_rgba(34,211,238,0.16)] overflow-hidden pointer-events-auto animate-fade-in premium-spotify-shell">
            <div className="px-3 py-2 border-b border-cyan-900/40 bg-gradient-to-r from-cyan-950/35 via-black/55 to-black/45 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-cyan-200">
                    <Disc3 size={13} className={`text-cyan-300 ${isPlaying ? 'spotify-disc-spin' : ''}`} />
                    <span className="text-[10px] uppercase tracking-[0.18em] font-semibold">Spotify Live</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-300/85 flex-wrap">
                    <button
                        onClick={onToggleShuffle}
                        className={`px-1.5 py-0.5 rounded border transition-colors duration-200 ${shuffleEnabled ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/20' : 'border-cyan-900/60 bg-black/30 text-cyan-500/70 hover:border-cyan-700/70'}`}
                        title="Toggle shuffle"
                    >
                        <Shuffle size={11} className="inline mr-1" />
                        {shuffleEnabled ? 'Shuffle On' : 'Shuffle Off'}
                    </button>
                    <button
                        onClick={onCycleRepeat}
                        className={`px-1.5 py-0.5 rounded border transition-colors duration-200 ${repeatState !== 'off' ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/20' : 'border-cyan-900/60 bg-black/30 text-cyan-500/70 hover:border-cyan-700/70'}`}
                        title="Cycle repeat mode"
                    >
                        <Repeat size={11} className="inline mr-1" />
                        Repeat {repeatState}
                    </button>
                </div>
            </div>

            <div className="p-3 grid grid-cols-[76px_1fr] lg:grid-cols-[76px_1fr_180px] gap-3 items-start">
                <div className="rounded-xl border border-cyan-900/45 bg-gradient-to-br from-cyan-950/20 to-black/40 p-1.5 flex items-center justify-center premium-spotify-card">
                    {track.image_url ? (
                        <img src={track.image_url} alt="cover" className="w-[64px] h-[64px] rounded-lg object-cover shadow-[0_0_12px_rgba(34,211,238,0.18)]" />
                    ) : (
                        <div className="w-[64px] h-[64px] rounded-lg border border-cyan-900/50 bg-black/40 flex items-center justify-center text-cyan-500/60 text-[10px]">
                            No Cover
                        </div>
                    )}
                </div>

                <div className="premium-spotify-card rounded-xl border border-cyan-900/45 bg-gradient-to-br from-cyan-950/14 to-black/35 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-cyan-100 text-sm font-semibold leading-snug truncate">{track.name || 'No active track'}</div>
                        <div className={`spotify-wave ${isPlaying ? 'is-playing' : ''}`} aria-hidden="true">
                            <span style={{ animationDelay: '0s' }} />
                            <span style={{ animationDelay: '0.12s' }} />
                            <span style={{ animationDelay: '0.24s' }} />
                            <span style={{ animationDelay: '0.36s' }} />
                        </div>
                    </div>
                    <div className="text-cyan-300/85 text-xs mt-0.5 truncate">{subtitle}</div>
                    <div className="text-cyan-500/80 text-[10px] mt-0.5 truncate">{track.album || 'n/a'}</div>
                    <div className="mt-2">
                        <div className="spotify-progress-rail h-2 rounded-full border border-cyan-900/50 bg-cyan-950/50 overflow-hidden">
                            <div className="spotify-progress-fill h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-cyan-300/80">
                            <span>{formatMs(progressMs)}</span>
                            <span>{formatMs(durationMs)}</span>
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            onClick={onPrevious}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-cyan-700/50 bg-black/35 text-cyan-200 hover:border-cyan-400/70 transition-colors duration-200"
                            title="Previous track"
                        >
                            <SkipBack size={11} className="inline mr-1" />
                            Prev
                        </button>
                        <button
                            onClick={onNext}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-cyan-700/50 bg-black/35 text-cyan-200 hover:border-cyan-400/70 transition-colors duration-200"
                            title="Next track"
                        >
                            <SkipForward size={11} className="inline mr-1" />
                            Next
                        </button>
                        <button
                            onClick={isFavorite ? onRemoveFromFavorites : onAddToFavorites}
                            disabled={!trackAvailable}
                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-cyan-700/50 bg-black/35 text-cyan-200 hover:border-cyan-400/70 hover:shadow-[0_0_12px_rgba(34,211,238,0.24)] transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed"
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <Heart size={11} className="inline mr-1" />
                            {isFavorite ? 'Remove Favorite' : 'Add Favorite'}
                        </button>
                    </div>
                </div>

                <div className="col-span-2 lg:col-span-1 rounded-xl border border-cyan-900/45 bg-gradient-to-br from-cyan-950/14 to-black/35 p-2 premium-spotify-card">
                    <div className="text-cyan-300 text-[10px] uppercase tracking-wider font-semibold mb-1.5">Up Next</div>
                    <div className="space-y-2">
                        {nextTracks.length === 0 && (
                            <div className="text-[11px] text-cyan-500/70">No queue data available.</div>
                        )}
                        {nextTracks.map((row, idx) => (
                            <div key={`${row.id || row.uri || idx}`} className="text-[11px] border border-cyan-900/35 rounded p-1.5 bg-black/30 hover:bg-cyan-950/20 transition-colors duration-200">
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
