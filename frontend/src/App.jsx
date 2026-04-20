import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search as SearchIcon, User, ChevronUp, ChevronDown } from 'lucide-react';
import Sidebar from './components/Sidebar';
import SongCard from './components/SongCard';
import BottomPlayer from './components/BottomPlayer';

function App() {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [recommendedNextSong, setRecommendedNextSong] = useState(null);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [showUpNext, setShowUpNext] = useState(true);
  const playedHistoryRef = useRef(new Set());
  const searchInputRef = useRef(null);

  useEffect(() => {
    const fetchInitialSongs = async () => {
      setIsLoading(true);
      try {
        const [hindiRes, punjabiRes] = await Promise.all([
          axios.post('http://localhost:5000/api/recommend', {
            query: "New Hindi Songs",
            fast_mode: true
          }),
          axios.post('http://localhost:5000/api/recommend', {
            query: "New Punjabi Songs",
            fast_mode: true
          })
        ]);

        const hindiSongs = hindiRes.data.results || [];
        const punjabiSongs = punjabiRes.data.results || [];


        const mixed = [
          ...hindiSongs.slice(0, 14),
          ...punjabiSongs.slice(0, 6)
        ];

        // Shuffle the results
        const shuffled = mixed.sort(() => 0.5 - Math.random());
        setSongs(shuffled);
      } catch (error) {
        console.error("Error fetching initial songs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialSongs();
  }, []);

  useEffect(() => {
    if (!currentSong) return;

    // Add current song to played history to prevent immediate loops
    playedHistoryRef.current.add(currentSong.id);

    const fetchNext = async () => {
      setIsFetchingNext(true);
      try {
        const yearPart = currentSong.year ? ` from year ${currentSong.year}` : ``;
        const queryText = `vibe similar to ${currentSong.track_name} by ${currentSong.artist_name}${yearPart}`;
        const response = await axios.post('http://localhost:5000/api/recommend', {
          query: queryText,
          fast_mode: false,
          reference_song: currentSong
        });

        const cands = response.data.results || [];

        const isValidSong = (s, currentSong) => {
          if (s.id === currentSong.id) return false;

          const sName = s.track_name.toLowerCase();
          const cName = currentSong.track_name.toLowerCase();

          // Severe string mismatch guard to prevent 'Title (Remix)' vs 'Title'
          if (cName.length > 4 && sName.includes(cName)) return false;
          if (sName.length > 4 && cName.includes(sName)) return false;

          // Guard against tunes, instrumentals, ringtones, karaoke if the original wasn't one
          const avoidKeywords = ['instrumental', 'karaoke', 'ringtone', 'tune', 'lofi', 'lo-fi', 'beats', 'bgm'];
          const isCurrentInstrumental = avoidKeywords.some(kw => cName.includes(kw));

          if (!isCurrentInstrumental) {
            if (avoidKeywords.some(kw => sName.includes(kw))) return false;
          }

          return true;
        };

        // 1. Try to find a song we haven't played yet and isn't functionally identical
        let nextSong = cands.find(s =>
          !playedHistoryRef.current.has(s.id) && isValidSong(s, currentSong)
        );

        // 2. Fallback if we exhausted the top list: pick a random valid song
        if (!nextSong) {
          const validCands = cands.filter(s => isValidSong(s, currentSong));
          if (validCands.length > 0) {
            nextSong = validCands[Math.floor(Math.random() * validCands.length)];
          }
        }

        if (nextSong) {
          setRecommendedNextSong(nextSong);
        } else {
          setRecommendedNextSong(null);
        }
      } catch (error) {
        console.error("Error fetching recommended next:", error);
      } finally {
        setIsFetchingNext(false);
      }
    };

    fetchNext();
  }, [currentSong]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      // Connect to the Flask backend running on port 5000
      const response = await axios.post('http://localhost:5000/api/recommend', {
        query: query
      });
      setSongs(response.data.results || []);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      alert("Failed to get recommendations. Please check if backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaySong = (song) => {
    setCurrentSong(song);
  };

  const handleHomeClick = () => {
    setQuery('');
    setHasSearched(false);
    setSongs([]);
  };

  const handleSearchClick = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const currentSongIndex = currentSong ? songs.findIndex(s => s.id === currentSong.id) : -1;

  const handleNextSong = () => {
    if (recommendedNextSong) {
      setCurrentSong(recommendedNextSong);
    } else if (currentSongIndex >= 0 && currentSongIndex < songs.length - 1) {
      setCurrentSong(songs[currentSongIndex + 1]);
    }
  };

  const handlePrevSong = () => {
    if (currentSongIndex > 0) {
      setCurrentSong(songs[currentSongIndex - 1]);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar onHomeClick={handleHomeClick} onSearchClick={handleSearchClick} />

      <div className="main-view">
        <header className="header">
          <div className="header-left">
            <div className="nav-buttons">
              <button><ChevronLeft size={24} /></button>
              <button><ChevronRight size={24} /></button>
            </div>

            <form onSubmit={handleSearch} className="search-box">
              <SearchIcon size={20} color="white" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="What do you want to play?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
          </div>

          <div className="header-right">
            <button className="btn-primary">Rag Recommender</button>
            <button className="nav-buttons" style={{ background: 'black', width: 0, height: 0 }}>
              <User size={16} />
            </button>
          </div>
        </header>

        <div className="content-area">
          {currentSong && (
            <div style={{ marginBottom: 40, padding: 24, backgroundColor: 'var(--bg-elevated-base)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 20, margin: 0 }}>Up Next (Semantic Match)</h2>
                  <p style={{ color: 'var(--text-subdued)', marginTop: 4, marginBottom: 0, fontSize: 13 }}>Automatically queued based on "{currentSong.track_name}"</p>
                </div>
                <button className="icon-btn-small" onClick={() => setShowUpNext(!showUpNext)}>
                  {showUpNext ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </button>
              </div>

              {showUpNext && (
                isFetchingNext ? (
                  <div style={{ color: 'var(--text-subdued)' }}>Analyzing vibe for next track...</div>
                ) : recommendedNextSong ? (
                  <div className="card-grid">
                    <SongCard song={recommendedNextSong} onPlay={handlePlaySong} />
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-subdued)' }}>No semantic matches found.</div>
                )
              )}
            </div>
          )}

          {!hasSearched && !currentSong && (
            <div className="greeting-section">
              <h1 className="greeting">Good afternoon</h1>
              <p style={{ color: 'var(--text-subdued)' }}>Enter your vibe in the search bar above to generate a great recommendation from JioSaavn.</p>
            </div>
          )}

          {isLoading ? (
            <div style={{ color: 'var(--text-subdued)', marginTop: 40 }}>Loading...</div>
          ) : (
            (hasSearched || songs.length > 0) && (
              <>
                <h1 className="greeting">{hasSearched ? "Top results" : "Suggested For You"}</h1>
                {songs.length > 0 ? (
                  !hasSearched ? (
                    <div className="carousel-container">
                      <div className="carousel-track">
                        {songs.map((song, i) => (
                          <SongCard
                            key={song.id ? `${song.id}-${i}` : i}
                            song={song}
                            onPlay={handlePlaySong}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="card-grid">
                      {songs.map((song, i) => (
                        <SongCard
                          key={song.id || i}
                          song={song}
                          onPlay={handlePlaySong}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <div style={{ color: 'var(--text-subdued)' }}>No results found for your query. Try a different vibe!</div>
                )}
              </>
            )
          )}
        </div>
      </div>

      <BottomPlayer
        currentSong={currentSong}
        onNext={(recommendedNextSong || (currentSongIndex >= 0 && currentSongIndex < songs.length - 1)) ? handleNextSong : null}
        onPrev={currentSongIndex > 0 ? handlePrevSong : null}
      />
    </div>
  );
}

export default App;
