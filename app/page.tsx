'use client';

import React, { useEffect } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
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
      
      <PanelGroup direction="horizontal" className="content-panel-group">
        {isInstrumentSidebarVisible && (
          <>
            <Panel defaultSize={20} minSize={10} maxSize={40} collapsible={true} collapsedSize={0} id="sidebar-panel">
              <div className="sidebar-area">
                <InstrumentSidebar />
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle horizontal-handle" />
          </>
        )}
        <Panel id="main-content-panel">
          <PanelGroup direction="vertical" className="main-content-panel-group">
            <Panel defaultSize={50} minSize={20} id="top-panel">
              <PanelGroup direction="horizontal" className="top-panel-group">
                <Panel defaultSize={50} minSize={20} id="detail-panel">
                  <div className="detail-container">
                    <DetailView />
                  </div>
                </Panel>
                <PanelResizeHandle className="resize-handle horizontal-handle" />
                <Panel minSize={20} id="visualizer-panel">
                  <div className="visualizer-container">
                    <VisualizerView />
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="resize-handle vertical-handle" />
            <Panel minSize={20} id="timeline-panel">
              <div className="bottom-section">
                <TimelineView />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      <div className="audio-loader-container">
        <AudioLoader />
      </div>
      
      <style jsx>{`
        /* Container styles */
        .main-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          position: fixed;
          overflow: hidden;
        }
        
        .playbar-container {
          height: 80px; /* Fixed height */
          width: 100%;
          border-bottom: 1px solid #ccc;
          flex-shrink: 0; /* Prevent shrinking */
          display: flex;
          align-items: center;
          padding: 0 10px;
          box-sizing: border-box;
        }

        /* Panel Group Styles */
        .content-panel-group,
        .main-content-panel-group,
        .top-panel-group {
          height: 100%; /* Ensure groups fill their parent */
          width: 100%;
        }
        .content-panel-group {
           flex: 1; /* Allow this group to take remaining height */
           overflow: hidden; /* Prevent content overflow issues */
        }

        /* Area Styles (make them fill their panels) */
        .sidebar-area,
        .detail-container,
        .visualizer-container,
        .bottom-section {
          height: 100%;
          width: 100%;
          overflow: hidden; /* Contain content */
          display: flex; /* Ensure children can fill */
          flex-direction: column; /* Or row, depending on content */
        }
        
        /* Remove conflicting styles previously used for layout */
        /* .content-container { ... } */
        /* .sidebar-area { width: 250px; flex: 0 0 250px; ... } */
        /* .main-content-area { ... } */
        /* .top-section { ... } */
        /* .detail-container { border-right: 1px solid #ccc; flex: 1 1 50%; ... } */
        /* .visualizer-container { flex: 1 1 50%; ... } */
        /* .bottom-section { border-top: 1px solid #ccc; flex: 1 1 50%; ... } */

        /* Resize Handle Styles */
        .resize-handle {
          background-color: #e0e0e0; /* Light gray */
          border: 1px solid #ccc;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .resize-handle:hover {
          background-color: #d0d0d0; /* Darker gray on hover */
        }
        .resize-handle.horizontal-handle {
          width: 5px;
          cursor: col-resize;
        }
        .resize-handle.vertical-handle {
          height: 5px;
          cursor: row-resize;
        }
        
        .audio-loader-container {
          position: fixed; /* Keep it fixed */
          bottom: 0;
          left: 0;
          width: 100%;
          height: 50px; /* Fixed height */
          background-color: #f0f0f0;
          border-top: 1px solid #ccc;
          z-index: 10;
          display: flex;
          align-items: center;
          padding: 0 10px;
          box-sizing: border-box;
          flex-shrink: 0; /* Prevent shrinking */
        }
      `}</style>
    </main>
  );
}
