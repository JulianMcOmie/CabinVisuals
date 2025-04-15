'use client';

import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/store';

// Formatted time display component
const TimeDisplay: React.FC<{ beat: number }> = ({ beat }) => {
  // Calculate measures and beats (assuming 4/4 time signature)
  const measure = Math.floor(beat / 4) + 1; // Measures start at 1
  const beatInMeasure = (beat % 4) + 1; // Beats in measure start at 1
  
  // Format to 2 decimal places for partial beats
  const formattedBeat = beatInMeasure.toFixed(2);
  
  return (
    <div className="time-display" style={{ 
      fontFamily: 'monospace', 
      fontSize: '1.2rem',
      padding: '0.5rem 1rem',
      backgroundColor: '#222',
      color: '#fff',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '120px'
    }}>
      <span>{measure}:{formattedBeat}</span>
    </div>
  );
};

// Transport button component
const TransportButton: React.FC<{
  icon: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}> = ({ icon, onClick, active = false, disabled = false }) => {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      style={{ 
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        backgroundColor: active ? '#4CAF50' : '#333',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontSize: '16px'
      }}
    >
      {icon}
    </button>
  );
};

// BPM slider component
const BPMControl: React.FC<{
  bpm: number;
  onChange: (bpm: number) => void;
}> = ({ bpm, onChange }) => {
  const [tempBpm, setTempBpm] = useState(bpm.toString());
  
  // Update local state when prop changes
  useEffect(() => {
    setTempBpm(bpm.toString());
  }, [bpm]);
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(e.target.value, 10);
    setTempBpm(newBpm.toString());
    onChange(newBpm);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempBpm(e.target.value);
  };
  
  const handleInputBlur = () => {
    const newBpm = parseInt(tempBpm, 10);
    if (!isNaN(newBpm) && newBpm >= 20 && newBpm <= 300) {
      onChange(newBpm);
    } else {
      setTempBpm(bpm.toString());
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };
  
  return (
    <div className="bpm-control" style={{ 
      display: 'flex', 
      alignItems: 'center',
      gap: '8px'
    }}>
      <label style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>BPM:</label>
      <input 
        type="range" 
        min="20" 
        max="300" 
        value={bpm} 
        onChange={handleSliderChange}
        style={{ width: '100px' }}
      />
      <input 
        type="text" 
        value={tempBpm} 
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        style={{ 
          width: '50px', 
          textAlign: 'center',
          padding: '4px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
        aria-label="BPM Value"
      />
    </div>
  );
};

// Seek bar component
const SeekBar: React.FC<{
  currentBeat: number;
  isPlaying: boolean;
  totalBeats: number;
  onSeek: (beat: number) => void;
}> = ({ currentBeat, isPlaying, totalBeats, onSeek }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(currentBeat);
  
  // Update drag value when currentBeat changes, but only if not dragging
  useEffect(() => {
    if (!isDragging) {
      setDragValue(currentBeat);
    }
  }, [currentBeat, isDragging]);
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const beat = parseFloat(e.target.value);
    setDragValue(beat);
  };
  
  const handleDragStart = () => {
    setIsDragging(true);
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
    onSeek(dragValue);
  };
  
  return (
    <div className="seek-bar" style={{ 
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <input
        type="range"
        min="0"
        max={totalBeats}
        step="0.01"
        value={isDragging ? dragValue : currentBeat}
        onChange={handleSliderChange}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        style={{ 
          flex: 1,
          cursor: 'pointer'
        }}
      />
    </div>
  );
};

// Main PlaybarView component
const PlaybarView: React.FC = () => {
  const { 
    currentBeat, 
    isPlaying, 
    bpm, 
    play, 
    pause, 
    stop, 
    setBPM, 
    seekTo,
    isInstrumentSidebarVisible,
    toggleInstrumentSidebar
  } = useStore();
  
  // For demo purposes, set total measure length to 16 bars (64 beats in 4/4)
  const totalBeats = 64;
  
  return (
    <div className="playbar-view" style={{ 
      width: '100%',
      height: '100%', 
      padding: '0 15px', 
      display: 'flex', 
      alignItems: 'center',
      backgroundColor: 'gray',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        width: '100%',
        gap: '15px'
      }}>
        <button 
          onClick={toggleInstrumentSidebar}
          title={isInstrumentSidebarVisible ? "Hide Instruments" : "Show Instruments"}
          style={{
            background: isInstrumentSidebarVisible ? '#555' : '#333',
            border: 'none',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🎹
        </button>

        <div className="transport-buttons" style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '10px'
        }}>
          <TransportButton
            icon="⏹️"
            onClick={stop}
          />
          {isPlaying ? (
            <TransportButton
              icon="⏸️"
              onClick={pause}
              active={true}
            />
          ) : (
            <TransportButton
              icon="▶️"
              onClick={play}
            />
          )}
        </div>
        
        <TimeDisplay beat={currentBeat} />
        
        <SeekBar
          currentBeat={currentBeat}
          isPlaying={isPlaying}
          totalBeats={totalBeats}
          onSeek={seekTo}
        />
        
        <BPMControl
          bpm={bpm}
          onChange={setBPM}
        />
      </div>
    </div>
  );
};

export default PlaybarView; 