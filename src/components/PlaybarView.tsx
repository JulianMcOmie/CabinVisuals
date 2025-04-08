'use client';

import React from 'react';
import useStore from '../store/store';

const PlaybarView: React.FC = () => {
  const { play, pause, stop, currentBeat } = useStore();
  
  return (
    <div className="playbar-view">
      <h2>Playbar</h2>
      <div className="controls-container">
        <button onClick={play}>Play</button>
        <button onClick={pause}>Pause</button>
        <button onClick={stop}>Stop</button>
        <div>
          <label>Current Beat: {currentBeat}</label>
        </div>
        <p>TODO: Implement BPM control</p>
        <p>TODO: Implement time signature control</p>
        <p>TODO: Implement loop control</p>
        <p>TODO: Implement seek bar</p>
      </div>
    </div>
  );
};

export default PlaybarView; 