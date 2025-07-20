"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, Clock, Volume2, X, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useTranslationStore } from "@/lib/store"

interface ConversationMessage {
  text: string
  translated: string
  language: string
  timestamp: Date
  audioUrl?: string
}

export default function ConversationUI() {
  const { sourceLanguage, targetLanguage } = useTranslationStore()
  const [isActive, setIsActive] = useState(false)
  const [isChunkProcessing, setIsChunkProcessing] = useState(false)
  const [conversationTimeElapsed, setConversationTimeElapsed] = useState(0)
  const [conversationTimeLimit] = useState(300) // 5 minutes in seconds
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [latency, setLatency] = useState<number | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const conversationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialChunkTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { toast } = useToast()

  // Function to get language name from code
  const getLanguageName = (code: string) => {
    const map: Record<string, string> = {
      en: "English",
      hi: "Hindi",
      kn: "Kannada",
    }
    return map[code] || code
  }

  // Function to detect language from text
  const detectLanguage = (text: string): string => {
    // Check for Devanagari script (Hindi)
    const devanagariPattern = /[\u0900-\u097F]/
    if (devanagariPattern.test(text)) return "hi"

    // Check for Kannada script
    const kannadaPattern = /[\u0C80-\u0CFF]/
    if (kannadaPattern.test(text)) return "kn"

    // Default to English
    return "en"
  }

  // Process audio function with real API calls
  const processAudio = async (audioBlob: Blob, detectedLanguage?: string) => {
    const startTime = performance.now()
    setIsChunkProcessing(true)

    try {
      // Step 1: Transcribe the audio
      const transcriptionResponse = await fetch("/api/speech-to-text", {
        method: "POST",
        body: audioBlob,
      })

      if (!transcriptionResponse.ok) {
        const errorData = await transcriptionResponse.json()
        throw new Error(errorData.details || "Failed to transcribe audio")
      }

      const transcriptionData = await transcriptionResponse.json()
      const transcribedText = transcriptionData.text

      // Skip processing if no text was detected
      if (!transcribedText.trim()) {
        setIsChunkProcessing(false)
        return
      }

      const detectedLang = transcriptionData.language || detectedLanguage || sourceLanguage

      console.log(`Transcribed text: ${transcribedText} (${detectedLang})`)

      // Step 2: Determine target language
      let targetLang = targetLanguage
      if (detectedLang) {
        // If English is detected, translate to Hindi and vice versa
        targetLang = detectedLang === "en" ? "hi" : "en"
      }

      // Step 3: Translate the text
      const translationResponse = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcribedText,
          sourceLanguage: detectedLang,
          targetLanguage: targetLang,
          mode: "online",
        }),
      })

      if (!translationResponse.ok) {
        const errorData = await translationResponse.json()
        throw new Error(errorData.details || "Failed to translate text")
      }

      const translationData = await translationResponse.json()
      const translatedText = translationData.text

      console.log(`Translated text: ${translatedText}`)

      // Step 4: Generate speech for the translated text
      const ttsResponse = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: translatedText,
          language: targetLang,
        }),
      })

      if (!ttsResponse.ok) {
        throw new Error("Failed to generate speech")
      }

      const audioBlob2 = await ttsResponse.blob()
      const url = URL.createObjectURL(audioBlob2)
      setAudioUrl(url)

      // Add to conversation history
      const newMessage: ConversationMessage = {
        text: transcribedText,
        translated: translatedText,
        language: detectedLang,
        timestamp: new Date(),
        audioUrl: url,
      }

      setMessages((prev) => [...prev, newMessage])

      const endTime = performance.now()
      setLatency((endTime - startTime) / 1000) // Convert to seconds

      // Play the audio automatically
      if (audioRef.current) {
        setTimeout(() => {
          audioRef.current?.play()
        }, 100)
      }
    } catch (error) {
      console.error("Error processing audio:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process audio. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsChunkProcessing(false)
    }
  }

  // Start continuous recording with 5-second chunks
  const startContinuousRecording = async () => {
    try {
      setIsInitializing(true)

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Save stream reference for later cleanup
      streamRef.current = stream

      // Start the conversation timer (5 minutes)
      setConversationTimeElapsed(0)
      conversationTimerRef.current = setInterval(() => {
        setConversationTimeElapsed((prev) => {
          // If we've reached the time limit, stop the conversation
          if (prev >= conversationTimeLimit - 1) {
            stopConversation()
            return conversationTimeLimit
          }
          return prev + 1
        })
      }, 1000)

      // Process an initial chunk immediately to reduce startup delay
      const initialMediaRecorder = new MediaRecorder(stream)
      const initialAudioChunks: Blob[] = []

      initialMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          initialAudioChunks.push(event.data)
        }
      }

      initialMediaRecorder.onstop = async () => {
        if (initialAudioChunks.length > 0) {
          const audioBlob = new Blob(initialAudioChunks, { type: "audio/webm" })
          await processAudio(audioBlob)
        }
        setIsInitializing(false)
      }

      // Start recording initial chunk
      initialMediaRecorder.start()

      // Stop initial recording after 2 seconds
      initialChunkTimeoutRef.current = setTimeout(() => {
        if (initialMediaRecorder.state === "recording") {
          initialMediaRecorder.stop()
        }
      }, 2000)

      // Set up the chunk processing interval (every 3 seconds)
      chunkIntervalRef.current = setInterval(() => {
        // Create a new recorder for each chunk
        const mediaRecorder = new MediaRecorder(stream)
        const audioChunks: Blob[] = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          // Only process if we have audio data and not already processing
          if (audioChunks.length > 0 && !isChunkProcessing) {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
            await processAudio(audioBlob)
          }
        }

        // Start recording this chunk
        mediaRecorder.start()

        // Record for 3 seconds with 1 second overlap
        setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            mediaRecorder.stop()
          }
        }, 3000)
      }, 2000) // 2-second interval with 3-second recording creates 1-second overlap

      setIsActive(true)

      toast({
        title: "Conversation Started",
        description: "Recording in progress. Speak now...",
      })
    } catch (error) {
      console.error("Error starting continuous recording:", error)
      setIsInitializing(false)
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const startConversation = async () => {
    // Clear previous conversation
    setMessages([])

    // Start the continuous recording with chunking
    await startContinuousRecording()
  }

  const stopConversation = () => {
    // Clear all timers
    if (conversationTimerRef.current) {
      clearInterval(conversationTimerRef.current)
      conversationTimerRef.current = null
    }

    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }

    if (initialChunkTimeoutRef.current) {
      clearTimeout(initialChunkTimeoutRef.current)
      initialChunkTimeoutRef.current = null
    }

    // Stop the media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setIsActive(false)
    setIsInitializing(false)

    toast({
      title: "Conversation Stopped",
      description: "Conversation has ended.",
    })
  }

  // Format time for display (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Play audio for a specific message
  const playMessageAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.play()
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clear all timers
      if (conversationTimerRef.current) {
        clearInterval(conversationTimerRef.current)
      }

      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current)
      }

      if (initialChunkTimeoutRef.current) {
        clearTimeout(initialChunkTimeoutRef.current)
      }

      // Stop the media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>Real-Time Conversation</CardTitle>
          {isActive && (
            <Badge
              variant="outline"
              className="flex items-center gap-1 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
            >
              <Clock className="h-3 w-3" />
              {formatTime(conversationTimeLimit - conversationTimeElapsed)}
            </Badge>
          )}
        </div>
        {isActive && <Progress value={(conversationTimeElapsed / conversationTimeLimit) * 100} className="h-2 mt-2" />}
      </CardHeader>

      <CardContent className="flex-grow flex flex-col p-4 overflow-hidden">
        {/* Messages container */}
        <div className="flex-grow overflow-y-auto mb-4 pr-2">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              {isInitializing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
                  <p className="text-center font-medium">Initializing microphone...</p>
                  <p className="text-sm mt-2">Please speak when ready</p>
                </div>
              ) : isActive ? (
                <div className="flex flex-col items-center">
                  <Mic className="h-8 w-8 text-purple-600 mb-4 animate-pulse" />
                  <p className="text-center">Listening...</p>
                  <p className="text-sm mt-2">Speak in English or Hindi. The system will automatically translate.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <p className="text-center">Start a conversation to see messages here</p>
                  <p className="text-sm mt-2">Speak in English or Hindi. The system will automatically translate.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={index} className="flex flex-col">
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3 mb-1",
                      message.language === "en"
                        ? "bg-purple-100 dark:bg-purple-900/30 self-end"
                        : "bg-blue-100 dark:bg-blue-900/30 self-start",
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-medium">{message.language === "en" ? "English" : "Hindi"}</p>
                      <p className="text-xs text-slate-500">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                    </div>
                    <p>{message.text}</p>
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3 bg-slate-100 dark:bg-slate-800",
                      message.language === "en" ? "self-end" : "self-start",
                    )}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Translated to {message.language === "en" ? "Hindi" : "English"}
                      </p>
                      {message.audioUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 rounded-full"
                          onClick={() => message.audioUrl && playMessageAudio(message.audioUrl)}
                        >
                          <Volume2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p>{message.translated}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Status and controls */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            {isChunkProcessing && (
              <div className="flex items-center text-sm text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Processing...
              </div>
            )}

            {latency !== null && !isChunkProcessing && (
              <div className="text-xs text-slate-500">Last translation: {latency.toFixed(1)}s</div>
            )}

            <Button
              className={cn(
                "ml-auto",
                isActive || isInitializing ? "bg-red-500 hover:bg-red-600" : "bg-purple-600 hover:bg-purple-700",
              )}
              onClick={isActive || isInitializing ? stopConversation : startConversation}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Initializing...
                </>
              ) : isActive ? (
                <>
                  <X className="h-4 w-4 mr-2" /> Stop
                </>
              ) : (
                "Start Conversation"
              )}
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} className="hidden" />
    </Card>
  )
}
