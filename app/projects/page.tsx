"use client"

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import ProjectsDisplay from "../../src/components/ProjectsDisplay";
import { initializeStore } from '../../src/store/store'; // Import the initializer
import useStore from '../../src/store/store'; // Import the hook
import { createClient } from '../../src/utils/supabase/client'; // Import Supabase client
import type { User, Subscription } from '@supabase/supabase-js'; // Import User and Subscription types

// Define ProfileData type matching ProjectsDisplay (or import if shared)
interface ProfileData {
  first_name: string | null;
  last_name: string | null;
}

export default function ProjectsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const router = useRouter();
  const initAttemptCountRef = useRef(0);
  
  const projects = useStore((state) => state.projectList);
  const createNewProject = useStore((state) => state.createNewProject);
  const switchProject = useStore((state) => state.switchProject);
  const loadProjectList = useStore((state) => state.loadProjectList);

  useEffect(() => {
    initAttemptCountRef.current += 1;
    const currentAttempt = initAttemptCountRef.current;
    
    console.log(`ProjectsPage: useEffect run #${currentAttempt}`);
    
    // If we've tried too many times, something is wrong - just stop loading
    if (currentAttempt > 3) {
      console.error("ProjectsPage: Too many initialization attempts, stopping");
      setIsLoading(false);
      return;
    }
    
    let isMounted = true;
    let authSubscription: Subscription | null = null;
    const supabase = createClient();

    const initializeData = async () => {
      console.log(`ProjectsPage: initializeData START (attempt #${currentAttempt})`);
      try {
        // 1. Fetch initial user
        const { data: { user: initialUser } } = await supabase.auth.getUser();
        if (!isMounted) return;
        setUser(initialUser);
        console.log("User fetched:", initialUser?.id);

        // 2. Fetch initial profile if user exists
        if (initialUser) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', initialUser.id)
            .single();
          if (isMounted) {
            setProfile(profileError ? null : profileData);
          }
        } else {
          if (isMounted) setProfile(null);
        }

        // 3. Initialize store
        console.log("Initializing store...");
        await initializeStore();
        console.log("Store initialized");
        
        // Fetch Supabase-backed project list
        await loadProjectList();
        console.log("Projects loaded");
        if (!isMounted) return;

        // 4. Now set up listener for subsequent changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            const currentUser = session?.user ?? null;
            
            if (isMounted) {
              setUser(currentUser); 

              // Re-fetch profile based on new state
              if (currentUser) {
                const { data: profileData, error: profileError } = await supabase
                  .from('profiles')
                  .select('first_name, last_name')
                  .eq('user_id', currentUser.id)
                  .single();
                 if (isMounted) {
                    setProfile(profileError ? null : profileData);
                 }
              } else {
                setProfile(null);
              }
            }
          }
        );
        authSubscription = subscription;

      } catch (error) {
        console.error("Initialization or data fetching failed:", error);
        if (isMounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        // 5. Set loading false after all initial setup attempts
        if (isMounted) {
          console.log("Initialization complete, stopping loading");
          setIsLoading(false);
        }
      }
    };

    setIsLoading(true);
    initializeData();

    // Cleanup function
    return () => {
      console.log(`Unmounting (attempt #${currentAttempt})`);
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
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
     router.push(`/editor?project=${projectId}`); 
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
