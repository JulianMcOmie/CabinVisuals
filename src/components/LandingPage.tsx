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
  const [emailState, setEmailState] = useState<"idle" | "error" | "success" | "submitting">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (emailState === "error") {
        setErrorMessage("");
        setEmailState("idle");
    }

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

    setEmailState("submitting")
    setErrorMessage("")

    try {
        const response = await fetch('/api/add-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email.trim() }),
        });

        const data = await response.json();

        if (!response.ok) {
            setErrorMessage(data.error || `Error: ${response.statusText}`);
            setEmailState("error");
        } else {
            setEmailState("success");
        }
    } catch (error) {
        console.error("Failed to submit email:", error);
        setErrorMessage("An unexpected error occurred. Please try again.");
        setEmailState("error");
    }
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

      <header className="container flex h-20 items-center justify-between py-6 relative z-10 mx-auto px-4">
        <Link href="/" className="font-medium text-xl">
          Cabin Visuals
        </Link>
        <nav className="flex items-center gap-6">
          <Button
            onClick={focusEmailInput}
            className="btn-header-waitlist rounded-full bg-transparent border border-white text-white transition-colors"
          >
            Join Waitlist
          </Button>
        </nav>
      </header>

      <main className="flex-1 relative z-10">
        <section className="container flex flex-col items-center justify-center space-y-12 py-24 text-center md:py-32 mx-auto px-4">
          <div className="space-y-5">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
              Turn your MIDI into
              <br />
              <span className="text-electric-blue">visuals.</span>
            </h1>
            <p className="mx-auto max-w-[700px] text-lg text-gray-300 md:text-xl">
              {/* eslint-disable-next-line react/no-unescaped-entities */}
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
                    className={`email-input-field w-full rounded-full bg-black/50 border ${
                      emailState === "error" ? "border-red-500" : "border-gray-700"
                    } px-6 py-4 pr-12 text-white focus:border-electric-blue focus:ring-electric-blue focus:outline-none focus:glow-input transition-all`}
                    // @ts-expect-error State comparison causes type error
                    disabled={emailState === "submitting" || emailState === "success"}
                  />
                  <button
                    type="submit"
                    // @ts-expect-error State comparison causes type error
                    disabled={!email.trim() || !validateEmail(email) || emailState === "submitting" || emailState === "success"}
                    aria-label="Submit email"
                    className={`btn-email-submit absolute right-2 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 flex items-center justify-center transition-colors ${
                      // @ts-expect-error State comparison causes type error
                      email.trim() && validateEmail(email) && emailState !== "submitting" && emailState !== "success"
                        ? "bg-transparent text-electric-blue hover:bg-electric-blue/10"
                        : "bg-transparent text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {emailState === "submitting" ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                        <ArrowRight className="h-5 w-5" />
                    )}
                  </button>
                  {emailState === "error" && (
                    <div className="absolute -bottom-6 left-0 flex items-center text-red-500 text-sm">
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
                    <p className="text-sm text-electric-blue font-medium">You&apos;re on the waitlist!</p>
                    <p className="text-sm text-gray-400">
                      We can&apos;t wait to see the amazing visuals you&apos;ll create with Cabin Visuals.
                    </p>
                  </div>
                </div>
              )}
            </form>
             {/* Keep button group outside the form state */}
            <div className="space-y-8">
              <Button
                variant="outline"
                onClick={scrollToVideo}
                className="btn-main-demo rounded-full px-8 border-gray-700 text-white transition-all"
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
                src="https://www.youtube.com/watch?v=8jPhqXtWIUw" // Added parameters to YouTube URL
                title="Cabin Visuals Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </section>

          {/* Footer */}
      
    <div className="container py-12 mx-auto px-4">
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
        <p className="text-sm text-gray-400">© {new Date().getFullYear()} Cabin Visuals. All rights reserved.</p>
        <p className="text-sm text-gray-400 mt-4 md:mt-0">Made with ♥ for musicians and visual artists</p>
        </div>
    </div>
      </main>

    
    </div>
  )
} 