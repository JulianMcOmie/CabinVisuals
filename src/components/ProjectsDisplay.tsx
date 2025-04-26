"use client"
import Image from "next/image"
import { LogOut, ExternalLink, Plus, FileText, MessageSquare } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import styles from '@/app/projects/projects.module.css' // Assuming styles are specific to this display
import { ProjectMetadata } from '../store/projectSlice'; // Import the type
import type { User } from '@supabase/supabase-js'; // Import User type
import { logout } from "../../app/(auth)/actions"; // Corrected relative path
import { useState } from "react"; // Import useState

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

  // Call getInitials with potentially null/undefined values from profile
  const userInitials = getInitials(profile?.first_name, profile?.last_name);

  // Define the async handler for logout
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent double-clicks
    setIsLoggingOut(true); // Set loading state
    try {
      await logout();
      // Redirect happens in server action, no need to reset state here usually
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false); // Reset state on explicit failure if redirect doesn't happen
    }
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
          <DropdownMenu>
            <DropdownMenuTrigger className={styles.dropdownTriggerPlaceholder} disabled={isLoggingOut}>
              {/* Use calculated initials */}
              <span className={styles.dropdownTriggerText}>{userInitials}</span> 
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
              {(user || profile) && ( // Only show section if user or profile data is available
                <div className="px-3 py-2 text-sm text-white">
                  {/* Display Full Name if profile available */}
                  {profile && (profile.first_name || profile.last_name) && (
                     <p className="font-medium truncate">{`${profile.first_name || ''} ${profile.last_name || ''}`.trim()}</p>
                  )}
                  {/* Display user email */}
                  {user && (
                    <p className="text-gray-300 truncate">{user.email}</p>
                  )}
                </div>
              )}
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem className="flex items-center cursor-pointer text-white hover:bg-gray-700">
                <ExternalLink className="h-4 w-4 mr-2" />
                <span>Discord Community</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              {/* Logout Item with Loading State */}
              <DropdownMenuItem
                className={`flex items-center w-full text-red-400 cursor-pointer hover:bg-gray-700 rounded-sm text-sm p-1.5 focus:bg-gray-700 focus:text-red-400 ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoggingOut} // Disable when logging out
                onSelect={(event) => {
                  event.preventDefault();
                  handleLogout();
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {/* Change text when loading */}
                <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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