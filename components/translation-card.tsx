"use client"

import { useState, useRef } from "react"
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useTranslationStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export default function TranslationCard() {
  const { sourceLanguage, targetLanguage } = useTranslationStore()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcribedText, setTranscribedText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isOnlineMode, setIsOnlineMode] = useState(true)
  const [latency, setLatency] = useState<number | null>(null)
  const [isNoiseCancellationActive, setIsNoiseCancellationActive] = useState(true)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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

  // Process audio function with real API calls
  const processAudio = async (audioBlob: Blob) => {
    const startTime = performance.now()
    setIsProcessing(true)

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
      const detectedLang = transcriptionData.language || sourceLanguage

      setTranscribedText(transcribedText)
      console.log(`Transcribed text: ${transcribedText} (${detectedLang})`)

      // Step 2: Translate the text
      const translationResponse = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcribedText,
          sourceLanguage: detectedLang,
          targetLanguage: targetLanguage,
          mode: isOnlineMode ? "online" : "offline",
        }),
      })

      if (!translationResponse.ok) {
        const errorData = await translationResponse.json()
        throw new Error(errorData.details || "Failed to translate text")
      }

      const translationData = await translationResponse.json()
      const translatedText = translationData.text

      setTranslatedText(translatedText)
      console.log(`Translated text: ${translatedText}`)

      // Step 3: Generate speech for the translated text
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
      const url = URL.createObjectURL(audioBlob2)
      setAudioUrl(url)

      const endTime = performance.now()
      setLatency((endTime - startTime) / 1000) // Convert to seconds
    } catch (error) {
      console.error("Error processing audio:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process audio. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        processAudio(audioBlob)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)

      toast({
        title: "Recording started",
        description: "Speak now...",
      })
    } catch (error) {
      console.error("Error starting recording:", error)
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      // Stop all tracks on the stream
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())

      toast({
        title: "Recording stopped",
        description: "Processing your speech...",
      })
    }
  }

  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play()
    }
  }

  const toggleMode = () => {
    setIsOnlineMode(!isOnlineMode)
    toast({
      title: `Switched to ${!isOnlineMode ? "Online" : "Offline"} Mode`,
      description: !isOnlineMode ? "Using cloud services for higher accuracy" : "Using local models for lower latency",
    })
  }

  return (
    <Card className="shadow-lg">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left side - Input */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="mb-4 text-center">
              <h3 className="text-lg font-medium mb-2">Speak in {getLanguageName(sourceLanguage)}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Press the microphone button and start speaking
              </p>
            </div>

            <div className="relative mb-4">
              <Button
                size="lg"
                className={cn(
                  "h-24 w-24 rounded-full",
                  isRecording ? "bg-red-500 hover:bg-red-600" : "bg-purple-600 hover:bg-purple-700",
                )}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
              >
                {isRecording ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
              </Button>

              {isRecording && (
                <div className="absolute -top-2 -right-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                </div>
              )}
            </div>

            {isNoiseCancellationActive && (
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
              >
                Noise Cancellation Active
              </Badge>
            )}
          </div>

          {/* Right side - Output */}
          <div className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-lg">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Processing your speech...</p>
              </div>
            ) : (
              <>
                {transcribedText && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Transcribed Text ({getLanguageName(sourceLanguage)})
                    </h3>
                    <p className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                      {transcribedText}
                    </p>
                  </div>
                )}

                {translatedText && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Translated to {getLanguageName(targetLanguage)}
                    </h3>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <p>{translatedText}</p>
                      {audioUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          onClick={playAudio}
                        >
                          <Volume2 className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {latency !== null && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Time taken:{" "}
                    <span
                      className={
                        latency < 2 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                      }
                    >
                      {latency.toFixed(1)}s
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer with mode toggle */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch id="mode-toggle" checked={isOnlineMode} onCheckedChange={toggleMode} />
            <label
              htmlFor="mode-toggle"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {isOnlineMode ? "Online Mode (Higher Accuracy)" : "Offline Mode (Lower Latency)"}
            </label>
          </div>

          <Button variant="outline" size="sm">
            Correct Translation
          </Button>
        </div>
      </CardContent>

      {/* Hidden audio element for playback */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}
    </Card>
  )
}
