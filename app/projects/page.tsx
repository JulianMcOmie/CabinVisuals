"use client"
import Image from "next/image"
import { LogOut, ExternalLink, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
    <div className="flex min-h-screen flex-col bg-black text-white relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="blob-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <header className="container flex h-20 items-center justify-between py-6 relative z-10">
        <h1 className="font-medium text-xl">Projects</h1>
        <nav className="flex items-center gap-6">
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <div className="h-10 w-10 rounded-full bg-electric-blue/20 flex items-center justify-center cursor-pointer hover:bg-electric-blue/30 transition-colors">
                <span className="text-sm font-medium">JS</span>
              </div>
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

      <div className="container flex justify-end mt-4 mb-8 relative z-10">
        <Button className="rounded-full bg-electric-blue hover:bg-electric-blue/80 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      <main className="flex-1 relative z-10 container py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockProjects.map((project) => (
            <div
              key={project.id}
              className="project-card group relative rounded-xl border border-gray-800 bg-black/30 overflow-hidden transition-all cursor-pointer"
            >
              <div className="aspect-video relative">
                <Image
                  src={project.thumbnail || "/placeholder.svg"}
                  alt={project.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4 flex items-center justify-between">
                <h3 className="font-medium truncate">{project.title}</h3>
                <span className="text-sm text-gray-400">{project.duration}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
} 