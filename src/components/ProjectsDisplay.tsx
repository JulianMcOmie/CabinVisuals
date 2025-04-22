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

// Define props interface
interface ProjectsDisplayProps {
  projects: ProjectMetadata[];
  onCreateProject: () => void; // Add callback for creating new project
  onSelectProject: (projectId: string) => void; // Add callback for selecting a project
}

export default function ProjectsDisplay({ projects, onCreateProject, onSelectProject }: ProjectsDisplayProps) {
  // Note: The CSS module import might need adjustment if the CSS file isn't moved
  // or if it's intended to be used by the page container.
  // For now, assuming styles are relevant here.
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
            <DropdownMenuTrigger className={styles.dropdownTriggerPlaceholder}>
              {/* Placeholder - Needs actual user data */}
              <span className={styles.dropdownTriggerText}>JS</span> 
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
              <div className="px-3 py-2 text-sm text-white">
                {/* Placeholder - Needs actual user data */}
                <p className="text-gray-300">john@example.com</p>
              </div>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem className="flex items-center cursor-pointer text-white hover:bg-gray-700">
                <ExternalLink className="h-4 w-4 mr-2" />
                <span>Discord Community</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem className="flex items-center text-red-400 cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                <span>Log out</span>
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