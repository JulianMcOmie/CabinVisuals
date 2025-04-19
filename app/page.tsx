'use client';

import React, { useEffect } from 'react';
import TimelineView from '../src/components/TimelineView';
import VisualizerView from '../src/components/VisualizerView';
import PlaybarView from '../src/components/PlaybarView';
import DetailView from '../src/components/DetailView';
import AudioLoader from '../src/components/AudioLoader';
import InstrumentSidebar from '../src/components/InstrumentSidebar/InstrumentSidebar';
import useStore from '../src/store/store';
import { loadAudioFile } from '../src/lib/idbHelper';

export default function Home() {
  const isInstrumentSidebarVisible = useStore((state) => state.isInstrumentSidebarVisible);
  const loadAudioAction = useStore((state) => state.loadAudio);

  useEffect(() => {
    const attemptLoadPersistedAudio = async () => {
      console.log('Attempting to load persisted audio from IndexedDB...');
      try {
        const persistedFile = await loadAudioFile();
        if (persistedFile) {
          console.log('Found persisted audio file, attempting to load...');
          try {
            const arrayBuffer = await persistedFile.arrayBuffer();
            await loadAudioAction(arrayBuffer);
            console.log('Successfully loaded persisted audio file into store.');
          } catch (loadError) {
            console.error('Error processing or loading persisted audio file:', loadError);
          }
        } else {
          console.log('No persisted audio file found.');
        }
      } catch (idbError) {
        console.error('Error accessing IndexedDB for persisted audio:', idbError);
      }
    };

    attemptLoadPersistedAudio();
  }, [loadAudioAction]);

  return (
    <main className="main-container">
      <div className="playbar-container">
        <PlaybarView />
      </div>
      
      <div className="content-container">
        {isInstrumentSidebarVisible && (
          <div className="sidebar-area">
            <InstrumentSidebar />
          </div>
        )}
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

      <div className="audio-loader-container">
        <AudioLoader />
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
          transition: width 0.3s ease, flex-basis 0.3s ease, opacity 0.3s ease;
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

        .audio-loader-container {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 50px;
          background-color: #f0f0f0;
          border-top: 1px solid #ccc;
          z-index: 10;
          display: flex;
          align-items: center;
          padding: 0 10px;
          box-sizing: border-box;
        }
      `}</style>
    </main>
  );
}
