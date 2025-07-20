"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, Clock, Volume2, X, Mic, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useTranslationStore } from "@/lib/store"

interface ConferenceMessage {
  text: string
  translated: string
  timestamp: Date
  audioUrl?: string
  id: string // Add unique ID for tracking
}

export default function ConferenceUI() {
  const { sourceLanguage, targetLanguage } = useTranslationStore()
  const [isActive, setIsActive] = useState(false)
  const [isChunkProcessing, setIsChunkProcessing] = useState(false)
  const [conferenceTimeElapsed, setConferenceTimeElapsed] = useState(0)
  const [conferenceTimeLimit] = useState(1800) // 30 minutes in seconds
  const [messages, setMessages] = useState<ConferenceMessage[]>([])
  const [latency, setLatency] = useState<number | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const conferenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialChunkTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedTextRef = useRef<string>("")
  const playedAudioIds = useRef<Set<string>>(new Set()) // Track played audio IDs
  const isStoppingRef = useRef<boolean>(false) // Track if we're stopping

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

  // Improved hallucination detection with more sophisticated checks
  const isLikelyHallucination = (text: string): boolean => {
    const lowerText = text.toLowerCase().trim()

    // Check if the text is very short (likely noise)
    if (lowerText.length < 5) return true

    // Check if it's a repeat of the last processed text or a substring
    if (
      lastProcessedTextRef.current &&
      (lowerText === lastProcessedTextRef.current.toLowerCase().trim() ||
        lastProcessedTextRef.current.toLowerCase().includes(lowerText) ||
        lowerText.includes(lastProcessedTextRef.current.toLowerCase()))
    ) {
      return true
    }

    // Common hallucination phrases
    const hallucinations = [
      "thank you for watching",
      "thanks for watching",
      "please subscribe",
      "like and subscribe",
      "thank you for listening",
      "please like",
      "don't forget to",
      "click the bell",
    ]

    // Check for common hallucinations
    if (hallucinations.some((phrase) => lowerText.includes(phrase))) {
      return true
    }

    // Check for repetitive patterns that might indicate hallucination
    const words = lowerText.split(/\s+/)
    if (words.length >= 4) {
      const uniqueWords = new Set(words)
      if (uniqueWords.size <= words.length * 0.5) {
        return true // Too many repeated words
      }
    }

    return false
  }

  // Improved audio playback management
  const playAudioForMessage = async (message: ConferenceMessage) => {
    // Don't play if we're stopping or if this audio was already played
    if (isStoppingRef.current || playedAudioIds.current.has(message.id) || !message.audioUrl) {
      return
    }

    setIsPlayingAudio(true)
    setCurrentPlayingId(message.id)
    playedAudioIds.current.add(message.id)

    if (audioRef.current && message.audioUrl) {
      try {
        audioRef.current.src = message.audioUrl
        audioRef.current.playbackRate = 0.95 // Slightly slower for clarity

        await audioRef.current.play()

        // Wait for audio to finish playing
        await new Promise<void>((resolve, reject) => {
          const handleEnded = () => {
            audioRef.current?.removeEventListener("ended", handleEnded)
            audioRef.current?.removeEventListener("error", handleError)
            resolve()
          }

          const handleError = (error: Event) => {
            audioRef.current?.removeEventListener("ended", handleEnded)
            audioRef.current?.removeEventListener("error", handleError)
            reject(error)
          }

          // Check if we should stop during playback
          const checkStop = () => {
            if (isStoppingRef.current) {
              audioRef.current?.pause()
              audioRef.current?.removeEventListener("ended", handleEnded)
              audioRef.current?.removeEventListener("error", handleError)
              resolve()
              return
            }
            setTimeout(checkStop, 100)
          }

          audioRef.current?.addEventListener("ended", handleEnded)
          audioRef.current?.addEventListener("error", handleError)
          checkStop()
        })
      } catch (error) {
        console.error("Error playing audio:", error)
      }
    }

    setIsPlayingAudio(false)
    setCurrentPlayingId(null)

    // After playing, check if there are more unplayed messages
    if (!isStoppingRef.current) {
      setTimeout(() => {
        playNextUnplayedAudio()
      }, 500) // Natural pause between sentences
    }
  }

  // Find and play the next unplayed audio
  const playNextUnplayedAudio = () => {
    if (isStoppingRef.current || isPlayingAudio) return

    const nextMessage = messages.find((msg) => msg.audioUrl && !playedAudioIds.current.has(msg.id))

    if (nextMessage) {
      playAudioForMessage(nextMessage)
    }
  }

  // Process audio function with improved sentence handling
  const processAudio = async (audioBlob: Blob) => {
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
      let transcribedText = transcriptionData.text.trim()

      // Skip processing if no text was detected
      if (!transcribedText) {
        setIsChunkProcessing(false)
        return
      }

      // For conference mode, we only care about the source language
      // If the detected language is not the source language, we skip it
      const detectedLang = transcriptionData.language || sourceLanguage
      if (detectedLang !== sourceLanguage) {
        console.log(`Detected language ${detectedLang} is not the source language ${sourceLanguage}, skipping...`)
        setIsChunkProcessing(false)
        return
      }

      // Check for hallucinations or duplicates
      if (isLikelyHallucination(transcribedText)) {
        console.log(`Likely hallucination detected: "${transcribedText}", skipping...`)
        setIsChunkProcessing(false)
        return
      }

      // Check if this is a continuation of the previous text
      // If it starts with lowercase or doesn't have sentence-ending punctuation
      const isPreviousSentenceComplete = !lastProcessedTextRef.current || /[.!?]$/.test(lastProcessedTextRef.current)

      const isLikelyContinuation =
        !isPreviousSentenceComplete &&
        (transcribedText[0] === transcribedText[0].toLowerCase() ||
          /^[,;:]/.test(transcribedText) ||
          /^(and|but|or|so|because|however|therefore|thus|moreover|furthermore|nevertheless|nonetheless|consequently|hence|also|besides|additionally|similarly|likewise|in addition|as a result|for example|for instance|in fact|indeed|in other words|in particular|specifically|that is|to illustrate|namely|such as)(\s|$)/i.test(
            transcribedText,
          ))

      // If this is likely a continuation, combine with previous text
      if (isLikelyContinuation && lastProcessedTextRef.current) {
        transcribedText = `${lastProcessedTextRef.current} ${transcribedText}`
        console.log(`Combined with previous text: "${transcribedText}"`)
      }

      console.log(`Transcribed text: ${transcribedText} (${detectedLang})`)

      // Save this text as the last processed text
      lastProcessedTextRef.current = transcribedText

      // Step 2: Translate the text from source to target language
      const translationResponse = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcribedText,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          mode: "online",
        }),
      })

      if (!translationResponse.ok) {
        const errorData = await translationResponse.json()
        throw new Error(errorData.details || "Failed to translate text")
      }

      const translationData = await translationResponse.json()
      const translatedText = translationData.text

      console.log(`Translated text: ${translatedText} (${sourceLanguage} → ${targetLanguage})`)

      // Step 3: Generate speech ONLY for the translated text
      const ttsResponse = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: translatedText,
          language: targetLanguage,
        }),
      })

      if (!ttsResponse.ok) {
        throw new Error("Failed to generate speech")
      }

      const audioBlob2 = await ttsResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob2)

      // Create unique ID for this message
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Add to conference history
      const newMessage: ConferenceMessage = {
        id: messageId,
        text: transcribedText,
        translated: translatedText,
        timestamp: new Date(),
        audioUrl: audioUrl,
      }

      setMessages((prev) => [...prev, newMessage])

      const endTime = performance.now()
      setLatency((endTime - startTime) / 1000) // Convert to seconds

      // Play the audio immediately if not currently playing
      if (!isPlayingAudio && !isStoppingRef.current) {
        setTimeout(() => {
          playAudioForMessage(newMessage)
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

  // Start continuous recording with optimized chunking for better sentence capture
  const startContinuousRecording = async () => {
    try {
      setIsInitializing(true)
      lastProcessedTextRef.current = ""
      playedAudioIds.current.clear()
      isStoppingRef.current = false
      setIsPlayingAudio(false)
      setCurrentPlayingId(null)

      // Get audio stream with optimized settings for speech clarity
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimize for speech recognition
        },
      })

      // Save stream reference for later cleanup
      streamRef.current = stream

      // Start the conference timer (30 minutes)
      setConferenceTimeElapsed(0)
      conferenceTimerRef.current = setInterval(() => {
        setConferenceTimeElapsed((prev) => {
          // If we've reached the time limit, stop the conference
          if (prev >= conferenceTimeLimit - 1) {
            stopConference()
            return conferenceTimeLimit
          }
          return prev + 1
        })
      }, 1000)

      // Set up the chunk processing interval with longer chunks for better sentence capture
      chunkIntervalRef.current = setInterval(() => {
        // Don't create new recordings if we're stopping
        if (isStoppingRef.current) return

        // Create a new recorder for each chunk
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: 128000, // Higher quality audio
        })
        const audioChunks: Blob[] = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          // Only process if we have audio data and not currently stopping
          if (audioChunks.length > 0 && !isStoppingRef.current) {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
            await processAudio(audioBlob)
          }
        }

        // Start recording this chunk
        mediaRecorder.start()

        // Record for 6 seconds for better sentence capture
        setTimeout(() => {
          if (mediaRecorder.state === "recording" && !isStoppingRef.current) {
            mediaRecorder.stop()
          }
        }, 6000)
      }, 4500) // 4.5-second interval with 6-second recording creates 1.5-second overlap

      setIsActive(true)
      setIsInitializing(false)

      toast({
        title: "Conference Started",
        description: `Speak in ${getLanguageName(sourceLanguage)}. Translation will be spoken in ${getLanguageName(targetLanguage)}.`,
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

  const startConference = async () => {
    // Clear previous conference
    setMessages([])
    playedAudioIds.current.clear()
    isStoppingRef.current = false

    // Start the continuous recording with chunking
    await startContinuousRecording()
  }

  const stopConference = () => {
    // Set stopping flag immediately
    isStoppingRef.current = true

    // Stop audio playback immediately
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }
    setIsPlayingAudio(false)
    setCurrentPlayingId(null)

    // Clear all timers
    if (conferenceTimerRef.current) {
      clearInterval(conferenceTimerRef.current)
      conferenceTimerRef.current = null
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
      title: "Conference Stopped",
      description: "Conference has ended.",
    })
  }

  // Format time for display (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Save conference transcript
  const saveConference = () => {
    if (messages.length === 0) {
      toast({
        title: "Nothing to save",
        description: "There are no messages in this conference.",
        variant: "destructive",
      })
      return
    }

    try {
      // Create text content
      let content = `# Conference Transcript\n\n`
      content += `Date: ${new Date().toLocaleDateString()}\n`
      content += `Source Language: ${getLanguageName(sourceLanguage)}\n`
      content += `Target Language: ${getLanguageName(targetLanguage)}\n\n`

      messages.forEach((message, index) => {
        const time = message.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })

        content += `## Message ${index + 1} (${time})\n\n`
        content += `Original (${getLanguageName(sourceLanguage)}): ${message.text}\n\n`
        content += `Translation (${getLanguageName(targetLanguage)}): ${message.translated}\n\n`
        content += `---\n\n`
      })

      // Create blob and download
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `conference-transcript-${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Transcript Saved",
        description: "Conference transcript has been saved to your downloads.",
      })
    } catch (error) {
      console.error("Error saving transcript:", error)
      toast({
        title: "Error",
        description: "Failed to save transcript. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Manual replay function for specific message
  const replayMessage = (message: ConferenceMessage) => {
    if (!isPlayingAudio && message.audioUrl) {
      // Temporarily remove from played set to allow replay
      playedAudioIds.current.delete(message.id)
      playAudioForMessage(message)
    }
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isStoppingRef.current = true

      // Clear all timers
      if (conferenceTimerRef.current) {
        clearInterval(conferenceTimerRef.current)
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

      // Stop audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
      }
    }
  }, [])

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            Conference Interpreter
            {isPlayingAudio && currentPlayingId && (
              <Badge
                variant="outline"
                className="text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 animate-pulse"
              >
                Speaking Translation
              </Badge>
            )}
          </CardTitle>
          {isActive && (
            <Badge
              variant="outline"
              className="flex items-center gap-1 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
            >
              <Clock className="h-3 w-3" />
              {formatTime(conferenceTimeLimit - conferenceTimeElapsed)}
            </Badge>
          )}
        </div>
        {isActive && <Progress value={(conferenceTimeElapsed / conferenceTimeLimit) * 100} className="h-2 mt-2" />}
      </CardHeader>

      <CardContent className="flex-grow flex flex-col p-4 overflow-hidden">
        {/* Language indicator */}
        <div className="flex justify-between mb-3 text-sm">
          <div className="flex items-center">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
              Speaker: {getLanguageName(sourceLanguage)}
            </Badge>
          </div>
          <div className="flex items-center">
            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Audience: {getLanguageName(targetLanguage)}
            </Badge>
          </div>
        </div>

        {isActive && (
          <div className="mb-3 text-center">
            <Badge
              variant="outline"
              className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
            >
              Prioritizing accuracy over speed - longer sentences will be processed for better flow
            </Badge>
          </div>
        )}

        {/* Messages container */}
        <div className="flex-grow overflow-y-auto mb-4 pr-2 border rounded-md p-2">
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
                  <p className="text-center font-medium">Listening for {getLanguageName(sourceLanguage)} speech...</p>
                  <p className="text-sm mt-2 text-center">
                    Only {getLanguageName(sourceLanguage)} will be translated to {getLanguageName(targetLanguage)}
                    <br />
                    Only the translated speech will be played aloud
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <p className="text-center">Start a conference for real-time interpretation</p>
                  <p className="text-sm mt-2 text-center">
                    Perfect for presentations or speeches
                    <br />
                    Only translated speech will be played - no original audio
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={message.id} className="flex flex-col border-b pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
                  <div className="flex justify-between items-center mb-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
                        currentPlayingId === message.id && "ring-2 ring-green-500",
                      )}
                    >
                      {getLanguageName(sourceLanguage)} Speaker
                      {playedAudioIds.current.has(message.id) && " ✓"}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Original:</p>
                    <p className="p-2 bg-slate-50 dark:bg-slate-900 rounded">{message.text}</p>
                  </div>

                  <div className="mb-1">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        🔊 Translated to {getLanguageName(targetLanguage)}:
                      </p>
                      {message.audioUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 rounded-full"
                          onClick={() => replayMessage(message)}
                          disabled={isPlayingAudio}
                        >
                          <Volume2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p
                      className={cn(
                        "p-2 bg-green-50 dark:bg-green-900/20 rounded",
                        currentPlayingId === message.id && "ring-2 ring-green-500 bg-green-100",
                      )}
                    >
                      {message.translated}
                    </p>
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
            <div className="flex items-center gap-4">
              {isChunkProcessing && (
                <div className="flex items-center text-sm text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  Processing...
                </div>
              )}

              {isPlayingAudio && currentPlayingId && (
                <div className="flex items-center text-sm text-green-600">
                  <Volume2 className="h-3 w-3 mr-2" />
                  Speaking translation...
                </div>
              )}

              {latency !== null && !isChunkProcessing && (
                <div className="text-xs text-slate-500">Last translation: {latency.toFixed(1)}s</div>
              )}
            </div>

            <div className="flex gap-2">
              {messages.length > 0 && (
                <Button variant="outline" size="sm" onClick={saveConference} disabled={isInitializing}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Transcript
                </Button>
              )}

              <Button
                className={cn(
                  isActive || isInitializing ? "bg-red-500 hover:bg-red-600" : "bg-purple-600 hover:bg-purple-700",
                )}
                onClick={isActive || isInitializing ? stopConference : startConference}
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
                  "Start Conference"
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} className="hidden" />
    </Card>
  )
}
