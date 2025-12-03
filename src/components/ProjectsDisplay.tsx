"use client"
import { LogOut, ExternalLink, Plus, FileText, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import styles from '../../app/projects/projects.module.css'
import { ProjectMetadata } from '../store/projectSlice'; // Import the type
import type { User } from '@supabase/supabase-js'; // Import User type
import { logout } from "../../app/(auth)/logout/actions"; // Corrected relative path
import { useState } from "react"; // Import useState
import { createClient } from "../utils/supabase/client"; // Correct the import path for the client-side helper
import LogInButton from "./AuthButtons/LogInButton";
import SignUpButton from "./AuthButtons/SignUpButton";
import useStore from '../store/store'; // Import useStore to access deleteProject

// Define a type for the profile data (adjust fields as needed)
interface ProfileData {
  first_name: string | null;
  last_name: string | null;
  // Add other profile fields if needed
}

// Define props interface
interface ProjectsDisplayProps {
  projects: ProjectMetadata[];
  user: User | null; // Add user prop
  profile: ProfileData | null; // Add profile prop
  onCreateProject: () => void; // Add callback for creating new project
  onSelectProject: (projectId: string) => void; // Add callback for selecting a project
}

// Helper function to get initials
const getInitials = (firstName: string | null | undefined, lastName: string | null | undefined): string => {
  const firstInitial = firstName?.[0]?.toUpperCase() || '';
  const lastInitial = lastName?.[0]?.toUpperCase() || '';
  return firstInitial && lastInitial ? `${firstInitial}${lastInitial}` : (firstInitial || lastInitial || '?'); // Fallback
};

export default function ProjectsDisplay({ 
  projects, 
  user, 
  profile, 
  onCreateProject, 
  onSelectProject 
}: ProjectsDisplayProps) {
  // Note: The CSS module import might need adjustment if the CSS file isn't moved
  // or if it's intended to be used by the page container.
  // For now, assuming styles are relevant here.

  const [isLoggingOut, setIsLoggingOut] = useState(false); // Add loading state
  const userInitials = getInitials(profile?.first_name, profile?.last_name);
  const deleteProject = useStore((state) => state.deleteProject); // Get deleteProject action

  // Handler for deleting a project
  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent triggering the card's onClick
    
    // Confirm before deleting
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      await deleteProject(projectId);
    }
  };

  // Define the async handler for logout
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent double-clicks
    setIsLoggingOut(true); // Set loading state
    
    const supabase = createClient(); // Create CLIENT instance

    try {
      // 1. Sign out on the client first to trigger local state updates
      const { error: clientSignOutError } = await supabase.auth.signOut();
      if (clientSignOutError) {
        // Log client-side error, but proceed to server logout anyway
        console.error("Client sign out error:", clientSignOutError.message);
      } else {
        console.log("Client signed out successfully.");
      }

      // 2. Call the server action to clear cookies and redirect
      await logout(); 
      // Redirect happens in server action, no need to reset loading state here
      // unless server action call *itself* fails.
    } catch (error) {
      // This catch block handles errors from calling the logout() server action
      console.error("Server logout action failed:", error);
      // Reset loading state only if the server action call fails
      setIsLoggingOut(false); 
    } 
    // No finally block needed to set loading false if redirect always happens
  };

  return (
    <div className={styles.pageContainer}> 
      {/* Animated background blobs - Consider if these belong here or on the page */}
      <div className={styles.blobContainer}>
        <div className={styles.blob1}></div>
        <div className={styles.blob2}></div>
        <div className={styles.blob3}></div>
      </div>

      <header className={styles.header}>
        <h1 className={`${styles.headerTitle} font-extrabold`}>Projects</h1>
        <nav className={styles.headerNav}>
          {user ? (
            // Show DropdownMenu if user is logged in
            <DropdownMenu>
              <DropdownMenuTrigger className={styles.dropdownTriggerPlaceholder} disabled={isLoggingOut}>
                <span className={styles.dropdownTriggerText}>{userInitials}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                {(user || profile) && (
                  <div className="px-3 py-2 text-sm text-white">
                    {profile && (profile.first_name || profile.last_name) && (
                      <p className="font-medium truncate">{`${profile.first_name || ''} ${profile.last_name || ''}`.trim()}</p>
                    )}
                    {user && (
                      <p className="text-gray-300 truncate">{user.email}</p>
                    )}
                  </div>
                )}
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem 
                  className="flex items-center cursor-pointer text-white hover:bg-gray-700"
                  onSelect={() => window.open('https://discord.gg/WhKZbH8nnV', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span>Discord Community</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem
                  className={`flex items-center w-full text-red-400 cursor-pointer hover:bg-gray-700 rounded-sm text-sm p-1.5 focus:bg-gray-700 focus:text-red-400 ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isLoggingOut}
                  onSelect={(event) => {
                    event.preventDefault();
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Use reusable Auth Button components
            <div className="flex items-center space-x-4">
              <LogInButton />
              <SignUpButton />
            </div>
          )}
        </nav>
      </header>

      <div className={styles.buttonContainer}>
        <button className={styles.createProjectButton} onClick={onCreateProject}>
          <Plus height={16} width={16} style={{ marginRight: '0.5rem' }} />
          Create Project
        </button>
      </div>

      <main className={styles.mainContent}>
        <div className={styles.projectsGrid}>
          {/* Map over the projects prop */}
          {projects.length === 0 ? (
             <p className={styles.noProjectsText}>No projects found. Create one to get started!</p>
          ) : (
            projects.map((project) => (
                <div 
                    key={project.id} 
                    className={styles.projectCard} 
                    onClick={() => onSelectProject(project.id)} // Make card clickable
                    style={{ cursor: 'pointer' }} // Add pointer cursor
                >
                <div className={styles.cardImageWrapper}>
                    <div className={styles.cardIconPlaceholder}>
                    <FileText className={styles.cardIcon} />
                    </div>
                    {/* Delete button - appears on hover */}
                    <button
                      className={styles.deleteButton}
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      aria-label="Delete project"
                      title="Delete project"
                    >
                      <X className={styles.deleteIcon} />
                    </button>
                </div>
                <div className={styles.cardContent}>
                    {/* Use project name from props */}
                    <h3 className={styles.cardTitle}>{project.name}</h3> 
                    {/* Remove hardcoded duration */}
                    {/* <span className={styles.cardDuration}>{project.duration}</span> */}
                </div>
                </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
