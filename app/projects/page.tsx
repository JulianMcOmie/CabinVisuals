"use client"

import { useEffect, useState } from 'react';
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
  
  const projects = useStore((state) => state.projectList);
  const createNewProject = useStore((state) => state.createNewProject);
  const switchProject = useStore((state) => state.switchProject);
  const loadProjectList = useStore((state) => state.loadProjectList);

  useEffect(() => {
    let isMounted = true;
    let authSubscription: Subscription | null = null;
    const supabase = createClient();

    const initializeData = async () => {
      // Don't set loading true here, do it before calling initializeData
      try {
        // 1. Fetch initial user
        const { data: { user: initialUser } } = await supabase.auth.getUser();
        if (!isMounted) return;
        setUser(initialUser);
        console.log("Initial user fetched:", initialUser?.id);

        // 2. Fetch initial profile if user exists
        if (initialUser) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', initialUser.id)
            .single();
          if (isMounted) {
            console.log("Initial profile fetched:", profileData, "Error:", profileError);
            setProfile(profileError ? null : profileData);
          }
        } else {
          if (isMounted) setProfile(null);
        }

        // 3. Initialize store
        console.log("Initializing store...");
        await initializeStore();
        console.log("Store initialized.");
        // Fetch Supabase-backed project list
        await loadProjectList();
        if (!isMounted) return;

        // 4. Now set up listener for subsequent changes
        console.log("Setting up auth listener...");
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            // Handle subsequent auth changes
            const currentUser = session?.user ?? null;
            console.log("Auth State Change Listener Fired:", _event, currentUser?.id);
            
            if (isMounted) {
              // Avoid setting state if user hasn't actually changed
              // This comparison might need adjustment based on how session objects behave
              // For simplicity, let's just update for now, but could be optimized
              setUser(currentUser); 

              // Re-fetch profile based on new state
              if (currentUser) {
                console.log("Auth listener fetching profile for:", currentUser.id);
                const { data: profileData, error: profileError } = await supabase
                  .from('profiles')
                  .select('first_name, last_name')
                  .eq('user_id', currentUser.id)
                  .single();
                 if (isMounted) {
                    console.log("Auth listener profile result:", profileData, "Error:", profileError);
                    setProfile(profileError ? null : profileData);
                 }
              } else {
                // Clear profile if logged out
                if (profile !== null) { // Only update if profile isn't already null
                   console.log("Auth listener clearing profile.");
                   setProfile(null); 
                }
              }
            }
          }
        );
        authSubscription = subscription;
        console.log("Auth listener set up.");

      } catch (error) {
        console.error("Initialization or data fetching failed:", error);
        if (isMounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        // 5. Set loading false after all initial setup attempts
        if (isMounted) {
          console.log("Setting loading to false.");
          setIsLoading(false);
        }
      }
    };

    setIsLoading(true); // Set loading true initially
    initializeData();

    // Cleanup function
    return () => {
      console.log("ProjectsPage unmounting - cleaning up listener.");
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
        console.log("Unsubscribed from auth changes");
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
     router.push(`/alpha?project=${projectId}`); 
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
