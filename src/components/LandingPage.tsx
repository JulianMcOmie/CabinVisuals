"use client"

import type React from "react"

import { useState, useRef } from "react"
import Link from "next/link"
import { ArrowDown, ArrowRight, AlertCircle, Twitter, Instagram, Youtube, Github } from "lucide-react"
import { Button } from "../components/ui/button" // Ensure path alias @/ is configured

export default function LandingPage() {
  const videoSectionRef = useRef<HTMLElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState("")
  const [emailState, setEmailState] = useState<"idle" | "error" | "success">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setEmailState("error")
      setErrorMessage("Please enter your email")
      return
    }

    if (!validateEmail(email)) {
      setEmailState("error")
      setErrorMessage("Please enter a valid email")
      return
    }

    // In a real app, you would submit to your API here
    console.log("Email submitted (simulated):", email); // Added console log for simulation
    setEmailState("success")
  }

  const scrollToVideo = () => {
    videoSectionRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const focusEmailInput = () => {
    emailInputRef.current?.focus()
  }

  return (
    // Ensure custom CSS classes like electric-blue, glow-*, blob-*, success-*, checkmark* are defined elsewhere
    <div className="flex min-h-screen flex-col bg-black text-white relative">
      {/* Animated background blobs */}
      <div className="blob-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <header className="container flex h-20 items-center justify-between py-6 relative z-10 mx-auto px-4 sm:px-6 lg:px-8"> {/* Added container padding */}
        <Link href="/" className="font-medium text-xl">
          Cabin Visuals
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/projects" className="text-sm font-medium">
            Projects
          </Link>
          <Link href="#" className="text-sm font-medium">
            About
          </Link>
          <Button
            onClick={focusEmailInput}
            className="rounded-full bg-transparent border border-white text-white hover:bg-electric-blue hover:border-electric-blue transition-colors"
          >
            Join Waitlist
          </Button>
        </nav>
      </header>

      <main className="flex-1 relative z-10">
        <section className="container flex flex-col items-center justify-center space-y-12 py-24 text-center md:py-32 mx-auto px-4 sm:px-6 lg:px-8"> {/* Added container padding */}
          <div className="space-y-5">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
              Turn your MIDI into
              <br />
              <span className="text-electric-blue">visuals.</span>
            </h1>
            <p className="mx-auto max-w-[700px] text-lg text-gray-300 md:text-xl">
              Create beautiful visuals that match your music perfectly - note-for-note.
            </p>
          </div>
          <div className="w-full max-w-md space-y-8">
            <form onSubmit={handleEmailSubmit} className="relative w-full">
              {emailState !== "success" && ( // Show form if not success
                <>
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailState === "error") setEmailState("idle")
                    }}
                    placeholder="Enter your email"
                    aria-label="Enter your email"
                    className={`w-full rounded-full bg-black/50 border ${
                      emailState === "error" ? "border-red-500" : "border-gray-700"
                    } px-6 py-4 pr-12 text-white focus:border-electric-blue focus:ring-electric-blue focus:outline-none focus:glow-input transition-all`}
                  />
                  <button
                    type="submit"
                    disabled={!email.trim() || !validateEmail(email)} // Also disable if invalid format
                    aria-label="Submit email"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 flex items-center justify-center transition-colors ${
                      email.trim() && validateEmail(email)
                        ? "bg-transparent hover:bg-electric-blue/20 text-electric-blue"
                        : "bg-transparent text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                  {emailState === "error" && (
                    <div className="absolute -bottom-6 left-0 flex items-center text-red-500 text-sm mt-1"> {/* Added margin-top */}
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {errorMessage}
                    </div>
                  )}
                </>
              )}

              {emailState === "success" && (
                <div className="success-animation">
                  <div className="flex items-center justify-center bg-black/50 border border-electric-blue rounded-full px-6 py-4 text-white">
                    <div className="checkmark-container mr-3">
                      <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
                        <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                      </svg>
                    </div>
                    <span className="font-medium">Thank you!</span>
                  </div>
                  <div className="mt-3 text-center space-y-1">
                    <p className="text-sm text-electric-blue font-medium">You're on the waitlist!</p>
                    <p className="text-sm text-gray-400">
                      We can't wait to see the amazing visuals you'll create with Cabin Visuals.
                    </p>
                  </div>
                </div>
              )}
            </form>
             {/* Keep button group outside the form state */}
            <div className="space-y-8 pt-4"> {/* Added padding top */}
              <Button
                variant="outline"
                onClick={scrollToVideo}
                className="rounded-full px-8 border-gray-700 text-white hover:border-electric-blue hover:bg-electric-blue/10 transition-all"
              >
                Watch Demo
              </Button>

              <div className="flex flex-col items-center space-y-2">
                <p className="text-sm text-gray-400">Scroll to explore</p>
                <ArrowDown className="h-6 w-6 animate-bounce text-gray-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Video Section */}
        <section
          ref={videoSectionRef}
          id="demo-video"
          className="container py-24 flex flex-col items-center justify-center mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="w-full max-w-5xl aspect-video rounded-xl overflow-hidden border border-gray-800 glow-subtle">
            <div className="relative w-full h-full bg-gray-900 flex items-center justify-center">
              {/* Consider adding a placeholder/thumbnail before the iframe loads */}
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1" // Added parameters to YouTube URL
                title="Cabin Visuals Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 mt-16">
        <div className="container py-12 mx-auto px-4 sm:px-6 lg:px-8"> {/* Added container padding */}
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-400">© {new Date().getFullYear()} Cabin Visuals. All rights reserved.</p>
            <p className="text-sm text-gray-400 mt-4 md:mt-0">Made with ♥ for musicians and visual artists</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 