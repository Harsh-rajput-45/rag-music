import React from 'react';
import { Play } from 'lucide-react';
import './SongCard.css';

const SongCard = ({ song, onPlay }) => {
  return (
    <div className="song-card" onClick={() => onPlay(song)}>
      <div className="card-image-container">
        <img 
          src={song.artwork_url || 'https://via.placeholder.com/150'} 
          alt={song.track_name} 
          className="card-image"
        />
        <button className="play-btn">
          <Play fill="black" size={24} />
        </button>
      </div>
      <div className="card-details">
        <h4 className="track-name" title={song.track_name}>
          {song.track_name}
        </h4>
        <p className="artist-name" title={song.artist_name}>
          {song.artist_name}
        </p>
      </div>
    </div>
  );
};

export default SongCard;
