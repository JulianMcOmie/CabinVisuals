"use client"

import { useEffect, useState } from 'react';
import ProjectsDisplay from "../../src/components/ProjectsDisplay";
import { initializeStore } from '../../src/store/store'; // Import the initializer

export default function ProjectsPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        await initializeStore();
      } catch (error) {
        console.error("Initialization failed:", error);
        // Handle critical initialization error if needed
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []); // Empty dependency array ensures this runs only once on mount

  if (isLoading) {
    // TODO: Replace with a proper loading component/spinner
    return <div style={{ padding: '20px' }}>Loading project data...</div>;
  }

  // Render the main component only after initialization is complete
  return (
    <ProjectsDisplay />
  );
}
