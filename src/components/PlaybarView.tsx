'use client';

import React from 'react';
import useStore from '../store/store';

const PlaybarView: React.FC = () => {
  const { play, pause, stop, currentBeat } = useStore();
  
  return (
    <div className="playbar-view" style={{ height: '100%', padding: '0 15px', display: 'flex', alignItems: 'center' }}>
      <h2 style={{ marginRight: '20px' }}>Playbar</h2>
      <div className="controls-container" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button onClick={play}>Play</button>
        <button onClick={pause}>Pause</button>
        <button onClick={stop}>Stop</button>
        <div>
          <label>Current Beat: {currentBeat}</label>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <p style={{ margin: 0 }}>TODO: BPM</p>
          <p style={{ margin: 0 }}>TODO: Time Sig</p>
          <p style={{ margin: 0 }}>TODO: Loop</p>
          <p style={{ margin: 0 }}>TODO: Seek</p>
        </div>
      </div>
    </div>
  );
};

export default PlaybarView; 