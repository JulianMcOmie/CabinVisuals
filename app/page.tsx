'use client';

import React from 'react';
import TimelineView from '../src/components/TimelineView';
import VisualizerView from '../src/components/VisualizerView';
import PlaybarView from '../src/components/PlaybarView';
import DetailView from '../src/components/DetailView';
import AudioLoader from '../src/components/AudioLoader';
import InstrumentSidebar from '../src/components/InstrumentSidebar/InstrumentSidebar';

export default function Home() {
  return (
    <main className="main-container">
      <div className="playbar-container">
        <PlaybarView />
        <AudioLoader />
      </div>
      
      <div className="content-container">
        <div className="sidebar-area">
          <InstrumentSidebar />
        </div>
        <div className="main-content-area">
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
      </div>
      
      <style jsx>{`
        .main-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          position: fixed;
          overflow: hidden;
        }
        
        .playbar-container {
          height: 80px;
          width: 100%;
          border-bottom: 1px solid #ccc;
          flex: 0 0 80px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          box-sizing: border-box;
        }
        
        .content-container {
          display: flex;
          flex-direction: row;
          flex: 1;
          width: 100%;
          overflow: hidden;
        }
        
        .sidebar-area {
          width: 250px;
          flex: 0 0 250px;
          height: 100%;
          overflow: hidden;
        }
        
        .main-content-area {
          display: flex;
          flex-direction: column;
          flex: 1;
          height: 100%;
          overflow: hidden;
        }
        
        .top-section {
          display: flex;
          width: 100%;
          flex: 1 1 50%;
          min-height: 0;
          overflow: hidden;
        }
        
        .detail-container {
          border-right: 1px solid #ccc;
          height: 100%;
          flex: 1 1 50%;
          min-width: 0;
          overflow: hidden;
        }
        
        .visualizer-container {
          height: 100%;
          flex: 1 1 50%;
          min-width: 0;
          overflow: hidden;
        }
        
        .bottom-section {
          width: 100%;
          border-top: 1px solid #ccc;
          flex: 1 1 50%;
          min-height: 0;
          overflow: hidden;
        }
      `}</style>
    </main>
  );
}
