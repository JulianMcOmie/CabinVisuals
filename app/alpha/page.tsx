'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  ImperativePanelHandle
} from 'react-resizable-panels';
import TimelineView from '../../src/components/TimelineView/TimelineView'; // Adjusted import path
import VisualizerView from '../../src/components/VisualizerView'; // Adjusted import path
import PlaybarView from '../../src/components/PlaybarView/PlaybarView'; // Adjusted import path
import DetailView from '../../src/components/DetailView/DetailView'; // Import from folder
import AudioLoader from '../../src/components/AudioLoader/AudioLoader'; // Adjusted import path
import InstrumentSidebar from '../../src/components/InstrumentSidebar/InstrumentSidebar'; // Adjusted import path
import useStore from '../../src/store/store'; // Adjusted import path
import { loadAudioFile } from '../../src/lib/idbHelper'; // Adjusted import path
import { initializeStore } from '../../src/store/store'; // Import the store initializer
import styles from './alpha.module.css';

// Interface for the panel ref 
interface PanelRef {
  collapse: () => void;
  expand: () => void;
}

// Renamed component to reflect the route
export default function AlphaPage() { 
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);

  // Fetch necessary state and actions from store
  const isInstrumentSidebarVisible = useStore((state) => state.isInstrumentSidebarVisible);
  const loadAudioAction = useStore((state) => state.loadAudio);

  // Effect to collapse/expand sidebar based on visibility state
  useEffect(() => {
    if (sidebarPanelRef.current) {
      if (isInstrumentSidebarVisible) {
        sidebarPanelRef.current.expand();
      } else {
        sidebarPanelRef.current.collapse();
      }
    }
  }, [isInstrumentSidebarVisible]);

  // Initialization Effect
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('AlphaPage: Initializing store and loading data...');
      setIsLoading(true); // Ensure loading state is true initially
      try {
        // Initialize the store (loads project based on last ID)
        await initializeStore(); 
        
        // Attempt to load any persisted audio file *after* store init
        console.log('Attempting to load persisted audio from IndexedDB...');
        const persistedFile = await loadAudioFile();
        if (persistedFile) {
          console.log('Found persisted audio file, attempting to load...');
          const arrayBuffer = await persistedFile.arrayBuffer();
          // Get the filename if available (only File objects have name, not Blob)
          const fileName = persistedFile instanceof File ? persistedFile.name : 'persisted-audio';
          // Use the action fetched via useStore
          await loadAudioAction(arrayBuffer, fileName);
          console.log('Successfully loaded persisted audio file into store.');
        } else {
          console.log('No persisted audio file found.');
        }
      } catch (error) {
        console.error('Initialization or audio loading failed:', error);
        // Handle critical initialization error if needed
      } finally {
        setIsLoading(false); // Set loading to false when done
      }
    };

    loadInitialData();
  }, [loadAudioAction]); // Include loadAudioAction in dependency array

  // Loading State Render
  if (isLoading) {
      // New loading indicator based on user request
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black gap-4">
          {/* Simple spinner */}
          <div className="w-8 h-8 border-2 border-slate-700 border-t-[#00a8ff] rounded-full animate-spin"></div>
          {/* Minimal text */}
          <p className="text-slate-500 text-sm font-light">loading project...</p>
        </div>
      )
  }

  // Main Content Render (only when not loading)
  return (
    <main className={styles.mainContainer}>
      <div className={styles.playbarContainer}>
        <PlaybarView />
      </div>
      
      <PanelGroup direction="horizontal" className={styles.contentPanelGroup}>
        <Panel 
          ref={sidebarPanelRef}
          defaultSize={20} 
          minSize={10} 
          maxSize={40} 
          collapsible={true} 
          collapsedSize={0} 
          id="sidebar-panel"
        >
          <div className={styles.sidebarArea}>
            <InstrumentSidebar />
          </div>
        </Panel>
        <PanelResizeHandle className={`${styles.resizeHandle} ${styles.horizontalHandle}`} />
        <Panel id="main-content-panel">
          <PanelGroup direction="vertical" className={styles.mainContentPanelGroup}>
            <Panel defaultSize={50} minSize={20} id="top-panel">
              <PanelGroup direction="horizontal" className={styles.topPanelGroup}>
                <Panel defaultSize={50} minSize={20} id="detail-panel">
                  <div className={styles.detailContainer}>
                    <DetailView />
                  </div>
                </Panel>
                <PanelResizeHandle className={`${styles.resizeHandle} ${styles.horizontalHandle}`} />
                <Panel minSize={20} id="visualizer-panel">
                  <div className={styles.visualizerContainer}>
                    <VisualizerView />
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className={`${styles.resizeHandle} ${styles.verticalHandle}`} />
            <Panel minSize={20} id="timeline-panel">
              <div className={styles.bottomSection}>
                <div className={styles.timelineViewWrapper}>
                  <TimelineView />
                </div>
                <div className={styles.audioLoaderWrapper}>
                  <AudioLoader />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </main>
  );
} 