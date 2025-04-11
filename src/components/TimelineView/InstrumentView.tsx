import React from 'react';
import useStore from '../../store/store';
import { Track } from '../../lib/types';

interface InstrumentViewProps {
  track: Track;
}

function InstrumentView({ track }: InstrumentViewProps) {
  const { selectTrack, selectedTrackId } = useStore();

  const isSelected = track.id === selectedTrackId;

  const handleClick = () => {
    selectTrack(track.id);
  };

  return (
    <div 
      className="instrument-view" 
      onClick={handleClick}
      style={{
        padding: '0 10px',
        height: '100%',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        color: '#ddd',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#333' : '#1a1a1a',
        transition: 'background-color 0.1s ease'
      }}
    >
      <div>{track.name || 'Untitled Track'}</div>
    </div>
  );
}

export default InstrumentView; 