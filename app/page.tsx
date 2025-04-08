'use client';

import React from 'react';
import TimelineView from '../src/components/TimelineView';
import VisualizerView from '../src/components/VisualizerView';
import PlaybarView from '../src/components/PlaybarView';
import DetailView from '../src/components/DetailView';

export default function Home() {
  return (
    <main className="main-container">
      <div className="playbar-container">
        <PlaybarView />
      </div>
      
      <div className="content-container">
        <div className="top-section">
          <div className="detail-container">
            <DetailView />
          </div>
          <div className="visualizer-container">
            <VisualizerView />
          </div>
        </div>
        
        <div className="bottom-section">
          <TimelineView />
        </div>
      </div>
      
      <style jsx>{`
        .main-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
        }
        
        .playbar-container {
          height: 80px;
          width: 100%;
          border-bottom: 1px solid #ccc;
        }
        
        .content-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          width: 100%;
        }
        
        .top-section {
          display: flex;
          height: 50%;
          width: 100%;
        }
        
        .detail-container {
          width: 30%;
          border-right: 1px solid #ccc;
          height: 100%;
          overflow: auto;
        }
        
        .visualizer-container {
          width: 70%;
          height: 100%;
          overflow: hidden;
        }
        
        .bottom-section {
          height: 50%;
          width: 100%;
          border-top: 1px solid #ccc;
          overflow: auto;
        }
      `}</style>
    </main>
  );
}
