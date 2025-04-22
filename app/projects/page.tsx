"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import ProjectsDisplay from "../../src/components/ProjectsDisplay";
import { initializeStore } from '../../src/store/store'; // Import the initializer
import useStore from '../../src/store/store'; // Import the hook

export default function ProjectsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  // Use the store hook to get state and actions
  const projects = useStore((state) => state.projectList);
  const createNewProject = useStore((state) => state.createNewProject);
  const switchProject = useStore((state) => state.switchProject);

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

  const handleCreateProject = async () => {
    // Prompt for project name or use a default
    const name = prompt("Enter new project name:", "Untitled Project");
    if (name !== null) { // Check if prompt was cancelled
       console.log(`Creating project: ${name}`);
       const newProjectId = await createNewProject(name);
       if (newProjectId) {
           console.log(`Project created with ID: ${newProjectId}. Switching...`);
           // Automatically switch to the new project after creation
           handleSelectProject(newProjectId);
       } else {
           alert("Failed to create project.");
       }
    }
  };

  const handleSelectProject = async (projectId: string) => {
     await switchProject(projectId);
     router.push('/alpha'); 
  };

  if (isLoading) {
    // TODO: Replace with a proper loading component/spinner
    return <div style={{ padding: '20px' }}>Loading project data...</div>;
  }

  // Pass the projects list and handlers to the display component
  return (
    <ProjectsDisplay 
        projects={projects}
        onCreateProject={handleCreateProject}
        onSelectProject={handleSelectProject}
    />
  );
}
