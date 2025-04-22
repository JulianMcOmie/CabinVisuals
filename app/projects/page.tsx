"use client"

import React, { useState, useEffect } from 'react';
import ProjectsDisplay from "../../src/components/ProjectsDisplay";
import useStore, { initializeStore } from '../../src/store/store'; // Import initializeStore

export default function ProjectsPage() {
  // State to track whether the store is initialized
  const [isStoreReady, setIsStoreReady] = useState(false);

  // Use effect to initialize the store on mount
  useEffect(() => {
    let isMounted = true; // Prevent state update on unmounted component
    console.log("ProjectsPage mounting, initializing store...");
    initializeStore()
      .then(() => {
        if (isMounted) {
          console.log("Store initialization promise resolved.");
          // We can double-check the flag in the store itself if needed,
          // but the promise resolving should mean it's ready.
          setIsStoreReady(true);
        }
      })
      .catch(error => {
         console.error("Store initialization failed in ProjectsPage:", error);
         // Optionally show an error state to the user
         if (isMounted) {
            // Even on error, we might want to allow rendering, 
            // but the store's isStoreInitialized flag will be false.
             setIsStoreReady(true); // Or false depending on desired error behavior
         }
      });

    return () => {
      isMounted = false; // Cleanup function
      console.log("ProjectsPage unmounting.");
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Optionally, select loading state from the store --- 
  // This provides a more direct way to check, once the store is available.
  // const isStoreInitializedFromState = useStore(state => state.isStoreInitialized);
  // Use `isStoreReady` for the initial gate, then potentially `isStoreInitializedFromState` for finer control.

  // Render loading indicator or the main component based on initialization status
  if (!isStoreReady) {
    // TODO: Replace with a proper loading spinner/component
    return <div>Loading Project Data...</div>; 
  }

  // Once the store is ready, render the main display component
  // ProjectsDisplay will use the `useStore` hook internally to get data.
  return (
    <ProjectsDisplay />
  );
}
