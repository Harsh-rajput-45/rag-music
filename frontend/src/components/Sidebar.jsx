import React from 'react';
import { Home, Search, Library, Plus, Heart } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ onHomeClick, onSearchClick }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <a href="#" className="sidebar-link active" onClick={(e) => { e.preventDefault(); if(onHomeClick) onHomeClick(); }}>
          <Home size={24} />
          <span>Home</span>
        </a>
        <a href="#" className="sidebar-link" onClick={(e) => { e.preventDefault(); if(onSearchClick) onSearchClick(); }}>
          <Search size={24} />
          <span>Search</span>
        </a>
      </div>
      
      <div className="sidebar-section bg-elevated library-section">
        <div className="library-header">
          <a href="#" className="sidebar-link">
            <Library size={24} />
            <span>Your Library</span>
          </a>
          <button className="icon-btn">
            <Plus size={20} />
          </button>
        </div>
        
        <div className="playlist-area">
          <div className="create-playlist">
            <h4>Create your first playlist</h4>
            <p>It's easy, we'll help you</p>
            <button className="badge-btn">Create playlist</button>
          </div>
          
          <div className="liked-songs">
            <div className="liked-icon">
              <Heart size={16} fill="white" />
            </div>
            <div className="liked-info">
              <h4>Liked Songs</h4>
              <p>Playlist • 0 songs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
