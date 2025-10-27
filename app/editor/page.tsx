'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  ImperativePanelHandle
} from 'react-resizable-panels';
import TimelineView from '../../src/components/TimelineView/TimelineView';
import VisualizerView from '../../src/components/VisualizerView';
import PlaybarView from '../../src/components/PlaybarView/PlaybarView';
import DetailView from '../../src/components/DetailView/DetailView';
import AudioLoader from '../../src/components/AudioLoader/AudioLoader';
import InstrumentSidebar from '../../src/components/InstrumentSidebar/InstrumentSidebar';
import useStore from '../../src/store/store';
import { loadAudioFile } from '../../src/lib/idbHelper';
import { initializeStore } from '../../src/store/store';
import styles from './editor.module.css';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '../../src/utils/supabase/client';
//import { logout } from './actions';
import type { User } from '@supabase/supabase-js';

interface PanelRef {
  collapse: () => void;
  expand: () => void;
}

function EditorPageContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const isInstrumentSidebarVisible = useStore((state) => state.isInstrumentSidebarVisible);
  const loadAudioAction = useStore((state) => state.loadAudio);
  const loadProject = useStore((state) => state.loadProject);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (sidebarPanelRef.current) {
      if (isInstrumentSidebarVisible) sidebarPanelRef.current.expand();
      else sidebarPanelRef.current.collapse();
    }
  }, [isInstrumentSidebarVisible]);

  useEffect(() => {
    const loadInitialData = async () => {
      console.log('EditorPage: Initializing store and loading data...');
      setIsLoading(true);
      try {
        await initializeStore();

        // After initializing the store, determine which project to load from URL
        const projectId = searchParams.get('project');
        if (projectId) {
          console.log('EditorPage: Detected project in URL, loading', projectId);
          await loadProject(projectId);
        } else {
          console.log('EditorPage: No project in URL, redirecting to /projects');
          router.push('/projects');
          return;
        }
        console.log('Attempting to load persisted audio from IndexedDB...');
        const persistedFile = await loadAudioFile();
        if (persistedFile) {
          console.log('Found persisted audio file...');
          const arrayBuffer = await persistedFile.arrayBuffer();
          const fileName = persistedFile instanceof File ? persistedFile.name : 'persisted-audio';
          await loadAudioAction(arrayBuffer, fileName);
          console.log('Successfully loaded persisted audio file into store.');
        } else {
          console.log('No persisted audio file found.');
        }
      } catch (error) {
        console.error('Initialization or audio loading failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [loadAudioAction, searchParams, loadProject, router]);

  if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black gap-4">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-[#00a8ff] rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm font-light">loading project...</p>
        </div>
      );
  }

  return (
    <div className={`${styles.editorPageWrapper} flex flex-col h-screen bg-black text-white`}>
      <main className={`${styles.mainContainer} flex-grow flex flex-col`}>
        <div className={styles.playbarContainer}>
          <PlaybarView user={user} />
        </div>
        
        <PanelGroup direction="horizontal" className={`${styles.contentPanelGroup} flex-grow`}>
          <Panel 
            ref={sidebarPanelRef}
            defaultSize={20} minSize={15} maxSize={35} 
            collapsible={true} collapsedSize={0} 
            id="sidebar-panel" order={1}
            className={styles.panelStyles} 
          >
            <div className={styles.sidebarArea}>
              <InstrumentSidebar />
            </div>
          </Panel>
          <PanelResizeHandle className={`${styles.resizeHandle} ${styles.horizontalHandle}`} />
          <Panel id="main-content-panel" order={2} className={styles.panelStyles}>
            <PanelGroup direction="vertical" className={styles.mainContentPanelGroup}>
              <Panel defaultSize={60} minSize={20} id="top-panel" className={styles.panelStyles}>
                <PanelGroup direction="horizontal" className={styles.topPanelGroup}>
                  <Panel defaultSize={50} minSize={20} id="detail-panel" className={styles.panelStyles}>
                    <div className={styles.detailContainer}>
                      <DetailView />
                    </div>
                  </Panel>
                  <PanelResizeHandle className={`${styles.resizeHandle} ${styles.horizontalHandle}`} />
                  <Panel minSize={20} id="visualizer-panel" className={styles.panelStyles}>
                    <div className={styles.visualizerContainer}>
                      <VisualizerView />
                    </div>
                  </Panel>
                </PanelGroup>
              </Panel>
              <PanelResizeHandle className={`${styles.resizeHandle} ${styles.verticalHandle}`} />
              <Panel defaultSize={40} minSize={20} id="timeline-panel" className={styles.panelStyles}>
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
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditorPageContent />
    </Suspense>
  );
} 