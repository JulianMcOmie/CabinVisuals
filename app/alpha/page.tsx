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
import Link from 'next/link';

// Interface for the panel ref 
interface PanelRef {
  collapse: () => void;
  expand: () => void;
}

// Renamed component to reflect the route
export default function AlphaPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="rounded-lg bg-gray-900/50 p-12 shadow-md border border-gray-800 text-center">
        <h1 className="mb-8 text-3xl font-bold text-white">
          Welcome
        </h1>
        <div className="space-y-4">
          <Link href="/login" legacyBehavior>
            <a className="block w-full rounded-full bg-indigo-600 px-8 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              Log In
            </a>
          </Link>
          <Link href="/signup" legacyBehavior>
            <a className="block w-full rounded-full border border-gray-600 px-8 py-3 text-lg font-semibold text-gray-300 shadow-sm hover:border-gray-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500">
              Sign Up
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
} 