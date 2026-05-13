'use client'

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipForward, SkipBack, Radio, Repeat, Repeat1, Shuffle, Moon, Sun, GripVertical, Minus } from 'lucide-react';
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube';

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
}

interface SavantRadioWidgetProps {
  playlistId?: string;
  apiBaseUrl?: string;
  defaultDark?: boolean;
  defaultExpanded?: boolean;
  initialPosition?: { x: number; y: number };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SavantRadioWidget({
  playlistId = 'PL6fZTBfxDZB0Gt5FGdutlBpMXuoGD0qWG',
  apiBaseUrl = '',
  defaultDark = true,
  defaultExpanded = false,
  initialPosition = { x: 24, y: 24 },
}: SavantRadioWidgetProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [dark, setDark] = useState(defaultDark);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [shuffleOn, setShuffleOn] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const hasInteracted = useRef(false);
  const timeInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const trackListRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const currentTrack = tracks[currentTrackIndex];

  const bg = dark ? 'bg-[#0a0a0a]' : 'bg-white';
  const text = dark ? 'text-white' : 'text-[#111]';
  const sub = dark ? 'text-white/25' : 'text-[#999]';
  const border = dark ? 'border-white/8' : 'border-[#ddd]';
  const controlColor = dark ? 'text-white/40' : 'text-[#444]';
  const active = dark ? 'text-accent' : 'text-[#b8a000]';
  const activeHover = dark ? 'hover:text-accent' : 'hover:text-[#b8a000]';
  const activeBg = dark ? 'bg-accent/5' : 'bg-[#b8a000]/10';
  const activeBorder = dark ? 'border-accent' : 'border-[#b8a000]';

  const fetchPlaylist = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/playlist?id=${id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTracks(data.tracks);
      const randomStart = Math.floor(Math.random() * data.tracks.length);
      setCurrentTrackIndex(randomStart);
    } catch {}
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchPlaylist(playlistId);
  }, [fetchPlaylist, playlistId]);

  const startTimeTracking = useCallback(() => {
    if (timeInterval.current) clearInterval(timeInterval.current);
    timeInterval.current = setInterval(() => {
      if (playerRef.current) {
        const t = playerRef.current.getCurrentTime();
        const d = playerRef.current.getDuration();
        if (typeof t === 'number') setCurrentTime(t);
        if (typeof d === 'number' && d > 0) setDuration(d);
      }
    }, 500);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (timeInterval.current) {
      clearInterval(timeInterval.current);
      timeInterval.current = null;
    }
  }, []);

  useEffect(() => () => stopTimeTracking(), [stopTimeTracking]);


  const onDragStart = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: position.x, startPosY: position.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPosition({
        x: dragRef.current.startPosX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.startPosY - (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      setDragging(false);
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [position]);

  useEffect(() => {
    const el = trackRefs.current.get(currentTrackIndex);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentTrackIndex]);

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    setCurrentTime(0);
    setDuration(0);
    hasInteracted.current = true;
    if (currentTrack) {
      event.target.loadVideoById(currentTrack.id);
    }
  };

  useEffect(() => {
    if (playerRef.current && currentTrack && hasInteracted.current) {
      playerRef.current.loadVideoById(currentTrack.id);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentTrackIndex]);

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    if (event.data === 1) {
      setIsPlaying(true);
      setLoading(false);
      startTimeTracking();
    } else if (event.data === 2) {
      setIsPlaying(false);
      stopTimeTracking();
    } else if (event.data === 0) {
      stopTimeTracking();
    }
  };

  const togglePlay = () => {
    hasInteracted.current = true;
    if (playerRef.current) {
      if (isPlaying) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
    }
  };

  const nextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    hasInteracted.current = true;
    setCurrentTime(0);
    setDuration(0);
    if (repeatMode === 'one') {
      playerRef.current?.seekTo(0);
      playerRef.current?.playVideo();
      return;
    }
    if (shuffleOn) {
      let next = Math.floor(Math.random() * tracks.length);
      while (next === currentTrackIndex && tracks.length > 1) next = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(next);
      return;
    }
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
  }, [tracks.length, currentTrackIndex, repeatMode, shuffleOn]);

  const prevTrack = () => {
    if (tracks.length === 0) return;
    hasInteracted.current = true;
    setCurrentTime(0);
    setDuration(0);
    if (shuffleOn) {
      let next = Math.floor(Math.random() * tracks.length);
      while (next === currentTrackIndex && tracks.length > 1) next = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(next);
      return;
    }
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !playerRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = ratio * duration;
    playerRef.current.seekTo(seekTime, true);
    setCurrentTime(seekTime);
  };

  const cycleRepeat = () => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const opts: YouTubeProps['opts'] = {
    height: '0',
    width: '0',
    playerVars: { autoplay: 0, controls: 0, modestbranding: 1 },
  };

  return (
    <div data-savant-radio>
      <div
        className={`fixed ${bg} rounded-2xl border ${border} shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden ${dragging ? 'cursor-grabbing' : ''}`}
        style={{ width: 300, bottom: position.y, left: position.x, zIndex: 9998 }}
      >
        <div
          className={`flex items-center justify-between px-3 py-1.5 border-b ${dark ? 'border-white/5' : 'border-[#e0e0e0]'} cursor-grab active:cursor-grabbing select-none`}
          onMouseDown={onDragStart}
          onDoubleClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-1.5">
            <GripVertical size={10} className={sub} />
            <Radio size={8} className={active} />
            <span className={`text-[8px] font-mono uppercase tracking-[0.2em] ${sub}`}>savant radio</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setDark(!dark)} className={`p-0.5 rounded ${dark ? 'hover:bg-white/10' : 'hover:bg-black/10'} ${controlColor}`}>
              {dark ? <Sun size={9} /> : <Moon size={9} />}
            </button>
            <button onClick={() => setExpanded(!expanded)} className={`p-0.5 rounded ${dark ? 'hover:bg-white/10' : 'hover:bg-black/10'} ${controlColor}`}>
              <Minus size={9} />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="flex gap-3 p-4">
                {currentTrack ? (
                  <img src={currentTrack.thumbnail} alt="" className="w-20 h-20 rounded-lg object-cover shadow-lg flex-shrink-0" />
                ) : (
                  <div className={`w-20 h-20 rounded-lg flex-shrink-0 ${dark ? 'bg-white/5' : 'bg-black/5'} flex items-center justify-center`}>
                    <Radio size={20} className={sub} />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <p className={`text-xs font-medium leading-tight line-clamp-2 ${text}`}>{currentTrack?.title || 'No track loaded'}</p>
                    <p className={`text-[9px] font-mono uppercase tracking-widest mt-1 ${sub}`}>{currentTrack?.artist || ''}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[8px] font-mono ${sub}`}>{formatTime(currentTime)}</span>
                    <div
                      ref={progressRef}
                      onClick={seekTo}
                      className={`flex-1 h-[3px] ${dark ? 'bg-white/10' : 'bg-black/15'} rounded-full overflow-hidden cursor-pointer group relative`}
                    >
                      <div className={`h-full ${dark ? 'bg-accent' : 'bg-[#b8a000]'} rounded-full transition-[width] duration-200`} style={{ width: `${progress}%` }} />
                    </div>
                    <span className={`text-[8px] font-mono ${sub}`}>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 pb-4">
                <button onClick={() => setShuffleOn(s => !s)} className={`transition-colors ${shuffleOn ? active : `${controlColor} ${activeHover}`}`}>
                  <Shuffle size={13} />
                </button>
                <button onClick={prevTrack} className={`${controlColor} ${activeHover}`}>
                  <SkipBack size={14} fill="currentColor" />
                </button>
                <button onClick={togglePlay} className={`${text} ${activeHover}`}>
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
                <button onClick={nextTrack} className={`${controlColor} ${activeHover}`}>
                  <SkipForward size={14} fill="currentColor" />
                </button>
                <button onClick={cycleRepeat} className={`transition-colors ${repeatMode !== 'off' ? active : `${controlColor} ${activeHover}`}`}>
                  {repeatMode === 'one' ? <Repeat1 size={13} /> : <Repeat size={13} />}
                </button>
              </div>

              <div ref={trackListRef} className={`border-t ${dark ? 'border-white/5' : 'border-[#e0e0e0]'} max-h-[200px] overflow-y-auto`}>
                {tracks.length > 0 ? (
                  tracks.map((track, i) => (
                    <button
                      key={track.id + i}
                      ref={(el) => { if (el) trackRefs.current.set(i, el); }}
                      onClick={() => { hasInteracted.current = true; setCurrentTrackIndex(i); setCurrentTime(0); setDuration(0); }}
                      className={`w-full text-left px-4 py-1.5 flex items-center gap-2 transition-colors ${i === currentTrackIndex ? `${activeBg} border-l-2 ${activeBorder}` : `${dark ? 'hover:bg-white/5' : 'hover:bg-black/5'} border-l-2 border-transparent`}`}
                    >
                      <span className={`text-[9px] font-mono ${i === currentTrackIndex ? active : controlColor}`}>{String(i + 1).padStart(2, '0')}</span>
                      <p className={`text-[10px] truncate flex-1 ${i === currentTrackIndex ? active : text}`}>{track.title}</p>
                      {i === currentTrackIndex && isPlaying && (
                        <div className="flex gap-0.5 items-end h-3 ml-auto flex-shrink-0">
                          <div className={`w-0.5 ${dark ? 'bg-accent' : 'bg-[#b8a000]'} animate-[bounce_0.6s_infinite] h-full`} />
                          <div className={`w-0.5 ${dark ? 'bg-accent' : 'bg-[#b8a000]'} animate-[bounce_0.8s_infinite] h-2/3`} />
                          <div className={`w-0.5 ${dark ? 'bg-accent' : 'bg-[#b8a000]'} animate-[bounce_0.5s_infinite] h-3/4`} />
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center">
                    <Radio className="animate-pulse mb-2" size={20} />
                    <p className={`text-[9px] font-mono uppercase tracking-widest ${sub}`}>loading...</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-2"
            >
              {loading ? (
                <>
                  <Radio size={12} className={`${active} animate-pulse`} />
                  <p className={`text-[10px] truncate flex-1 ${sub}`}>loading...</p>
                </>
              ) : (
                <>
                  {currentTrack && <img src={currentTrack.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                  <p className={`text-[10px] truncate flex-1 ${text}`}>{currentTrack?.title || 'No track'}</p>
                  <button onClick={togglePlay} className={`${text} ${activeHover}`}>
                    {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="hidden">
        {tracks.length > 0 && (
          <YouTube
            videoId={tracks[0].id}
            opts={opts}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onEnd={() => {
              hasInteracted.current = true;
              if (repeatMode === 'one') {
                playerRef.current?.seekTo(0);
                playerRef.current?.playVideo();
              } else {
                nextTrack();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
