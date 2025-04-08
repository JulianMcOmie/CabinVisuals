'use client';

import React from 'react';
import TrackListView from '../src/components/TrackListView';
import TimelineView from '../src/components/TimelineView';
import VisualizerView from '../src/components/VisualizerView';
import TransportControls from '../src/components/TransportControls';

export default function Home() {
  return (
    <main className="main-container">
      <div className="app-header">
        <h1>Visual DAW</h1>
      </div>
      
      <div className="app-layout">
        <div className="top-section">
          <div className="track-list-container">
            <TrackListView />
          </div>
          <div className="timeline-container">
            <TimelineView />
          </div>
        </div>
        
        <div className="middle-section">
          <TransportControls />
        </div>
        
        <div className="bottom-section">
          <VisualizerView />
        </div>
      </div>
      
      <style jsx>{`
        .main-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          padding: 20px;
        }
        
        .app-layout {
          display: flex;
          flex-direction: column;
          flex: 1;
          gap: 20px;
        }
        
        .top-section {
          display: flex;
          flex: 1;
          gap: 20px;
        }
        
        .track-list-container {
          width: 300px;
          border: 1px solid #ccc;
          padding: 10px;
        }
        
        .timeline-container {
          flex: 1;
          border: 1px solid #ccc;
          padding: 10px;
        }
        
        .middle-section {
          height: 80px;
          border: 1px solid #ccc;
          padding: 10px;
        }
        
        .bottom-section {
          flex: 1;
          border: 1px solid #ccc;
          padding: 10px;
        }
      `}</style>
    </main>
  );
}
