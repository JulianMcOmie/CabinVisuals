"use client"
import Image from "next/image"
import { LogOut, ExternalLink, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import styles from './projects.module.css'

// Mock project data
const mockProjects = [
  {
    id: 1,
    title: "Neon Dreams",
    thumbnail: "/project-thumbnail-1.png",
    duration: "3:24",
  },
  {
    id: 2,
    title: "Synthwave Sunset",
    thumbnail: "/project-thumbnail-2.png",
    duration: "4:15",
  },
  {
    id: 3,
    title: "Ambient Flow",
    thumbnail: "/project-thumbnail-3.png",
    duration: "2:58",
  },
  {
    id: 4,
    title: "Electric Pulse",
    thumbnail: "/project-thumbnail-4.png",
    duration: "5:12",
  },
]

export default function ProjectsPage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.blobContainer}>
        <div className={styles.blob1}></div>
        <div className={styles.blob2}></div>
        <div className={styles.blob3}></div>
      </div>

      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Projects</h1>
        <nav className={styles.headerNav}>
          <DropdownMenu>
            <DropdownMenuTrigger className={styles.dropdownTriggerPlaceholder}>
              <span className={styles.dropdownTriggerText}>JS</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
              <div className="px-3 py-2 text-sm">
                <p className="font-medium">John Smith</p>
                <p className="text-gray-400">john@example.com</p>
              </div>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem className="flex items-center cursor-pointer">
                <ExternalLink className="h-4 w-4 mr-2" />
                <span>Discord</span>
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
        <button className={styles.createProjectButton}>
          <Plus />
          Create Project
        </button>
      </div>

      <main className={styles.mainContent}>
        <div className={styles.projectsGrid}>
          {mockProjects.map((project) => (
            <div key={project.id} className={styles.projectCard}>
              <div className={styles.cardImageWrapper}>
                <Image
                  src={project.thumbnail || "/placeholder.svg"}
                  alt={project.title}
                  fill
                  className={styles.cardImage}
                />
              </div>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{project.title}</h3>
                <span className={styles.cardDuration}>{project.duration}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
