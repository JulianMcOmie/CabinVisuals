"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import ProjectsDisplay from "../../src/components/ProjectsDisplay";
import { initializeStore } from '../../src/store/store'; // Import the initializer
import useStore from '../../src/store/store'; // Import the hook
import { createClient } from '../../src/utils/supabase/client'; // Import Supabase client
import type { User } from '@supabase/supabase-js'; // Import User type

// Define ProfileData type matching ProjectsDisplay (or import if shared)
interface ProfileData {
  first_name: string | null;
  last_name: string | null;
}

export default function ProjectsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null); // Add user state
  const [profile, setProfile] = useState<ProfileData | null>(null); // Add profile state
  const router = useRouter();
  
  // Use the store hook to get state and actions
  const projects = useStore((state) => state.projectList);
  const createNewProject = useStore((state) => state.createNewProject);
  const switchProject = useStore((state) => state.switchProject);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const supabase = createClient(); // Create client instance
      try {
        // Initialize the store (fetches projects etc.)
        await initializeStore(); 

        // Fetch user and profile data
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser); // Set user state

        if (authUser) {
          // Fetch profile if user exists
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name') // Select only needed fields
            .eq('user_id', authUser.id) // Use user_id based on your schema
            .single();

          if (profileError) {
            console.error('Error fetching profile:', profileError.message);
            setProfile(null); // Handle error case
          } else {
            setProfile(profileData); // Set profile state
          }
        } else {
          setProfile(null); // No user, no profile
        }

      } catch (error) {
        console.error("Initialization or data fetching failed:", error);
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
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#111' }}>
             <div className="w-8 h-8 border-2 border-slate-700 border-t-[#00a8ff] rounded-full animate-spin"></div>
           </div>;
  }

  // Pass the projects list and handlers to the display component
  return (
    <ProjectsDisplay 
        projects={projects}
        user={user} // Pass user state
        profile={profile} // Pass profile state
        onCreateProject={handleCreateProject}
        onSelectProject={handleSelectProject}
    />
  );
}
