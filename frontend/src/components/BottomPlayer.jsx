import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart } from 'lucide-react';
import './BottomPlayer.css';

const BottomPlayer = ({ currentSong, onNext, onPrev }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    if (currentSong && currentSong.preview_url) {
      setCurrentTime(0);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.play().catch(e => console.error("Playback failed", e));
      }
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentSong]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error(e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(percent);
    if (audioRef.current) {
      audioRef.current.volume = percent;
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="player-bar">
      <div className="player-left">
        {currentSong ? (
          <>
            <img 
              src={currentSong.artwork_url || 'https://via.placeholder.com/56'} 
              alt={currentSong.track_name} 
              className="now-playing-img" 
            />
            <div className="now-playing-info">
              <a href={currentSong.view_url} target="_blank" rel="noreferrer" className="now-playing-title">
                {currentSong.track_name}
              </a>
              <div className="now-playing-artist">{currentSong.artist_name}</div>
            </div>
            <button 
              className="icon-btn-small" 
              onClick={() => {
                const btn = document.getElementById('heart-icon-' + currentSong.id);
                if (btn) btn.setAttribute('fill', btn.getAttribute('fill') === 'none' ? 'var(--essential-positive)' : 'none');
              }}
            >
              <Heart id={'heart-icon-' + currentSong.id} size={16} fill="none" />
            </button>
          </>
        ) : (
          <div className="empty-player-state">Select a song to play stream</div>
        )}
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button className="control-btn subtle" onClick={onPrev} disabled={!onPrev}>
            <SkipBack fill="white" size={20} />
          </button>
          <button className="control-btn play-pause-btn" onClick={togglePlay} disabled={!currentSong}>
            {isPlaying ? <Pause fill="black" size={20} /> : <Play fill="black" size={20} />}
          </button>
          <button className="control-btn subtle" onClick={onNext} disabled={!onNext}>
            <SkipForward fill="white" size={20} />
          </button>
        </div>
        <div className="progress-container">
          <span className="time-text">{formatTime(currentTime)}</span>
          <div className="progress-bar-bg" onClick={handleSeek} style={{ cursor: currentSong ? 'pointer' : 'default' }}>
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="time-text">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <Volume2 size={20} className="subtle-icon" />
        <div className="volume-bar-bg" onClick={handleVolumeChange} style={{ cursor: 'pointer' }}>
          <div className="volume-bar-fill" style={{ width: `${volume * 100}%` }}></div>
        </div>
      </div>

      {currentSong && currentSong.preview_url && (
        <audio 
          ref={audioRef} 
          src={currentSong.preview_url} 
          onEnded={() => {
             setIsPlaying(false);
             if (onNext) onNext();
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />
      )}
    </div>
  );
};

export default BottomPlayer;
