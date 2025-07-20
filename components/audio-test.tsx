"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function AudioTest() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [translatedAudioUrl, setTranslatedAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const translatedAudioRef = useRef<HTMLAudioElement | null>(null)

  const startRecording = async () => {
    try {
      setError(null)
      setResult(null)
      setAudioUrl(null)
      setTranslatedAudioUrl(null)
      setIsRecording(true)

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      })
      const audioChunks: Blob[] = []

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setIsRecording(false)
        setIsProcessing(true)

        try {
          // Create audio blob
          const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
          console.log(`Audio recorded: ${audioBlob.size} bytes`)

          // Create a URL for the audio blob
          const url = URL.createObjectURL(audioBlob)
          setAudioUrl(url)

          // First test with our debug endpoint
          console.log("Sending to test-audio endpoint...")
          const testResponse = await fetch("/api/test-audio", {
            method: "POST",
            body: audioBlob,
          })

          const testResult = await testResponse.json()
          console.log("Test endpoint result:", testResult)

          // Now try the actual transcription
          console.log("Sending to speech-to-text endpoint...")
          const response = await fetch("/api/speech-to-text", {
            method: "POST",
            body: audioBlob,
          })

          const data = await response.json()
          console.log("Speech-to-text result:", data)

          if (data.error) {
            setError(data.details || data.error)
          } else {
            setResult(data)

            // Now translate the text
            if (data.text) {
              const translateResponse = await fetch("/api/translate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  text: data.text,
                  sourceLanguage: data.language || "en",
                  targetLanguage: data.language === "en" ? "hi" : "en", // Translate to the other language
                  mode: "online",
                }),
              })

              const translateData = await translateResponse.json()
              console.log("Translation result:", translateData)

              if (translateData.text) {
                // Generate speech for the translated text
                const ttsResponse = await fetch("/api/text-to-speech", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    text: translateData.text,
                    language: data.language === "en" ? "hi" : "en",
                  }),
                })

                if (ttsResponse.ok) {
                  const audioBlob = await ttsResponse.blob()
                  const audioUrl = URL.createObjectURL(audioBlob)
                  setTranslatedAudioUrl(audioUrl)
                }
              }
            }
          }
        } catch (err) {
          console.error("Error processing audio:", err)
          setError(err instanceof Error ? err.message : "Unknown error")
        } finally {
          setIsProcessing(false)
        }
      }

      // Start recording
      mediaRecorder.start()

      // Stop after 5 seconds
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop()
          stream.getTracks().forEach((track) => track.stop())
        }
      }, 5000)
    } catch (err) {
      console.error("Error starting recording:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      setIsRecording(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Audio Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={startRecording} disabled={isRecording || isProcessing} className="w-full">
          {isRecording ? (
            "Recording... (5s)"
          ) : isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Record 5s Audio Sample"
          )}
        </Button>

        {audioUrl && (
          <div className="p-4 bg-slate-100 rounded-md">
            <p className="font-medium mb-2">Recorded Audio:</p>
            <audio ref={audioRef} src={audioUrl} controls className="w-full" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-800 rounded-md">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="p-4 bg-green-50 text-green-800 rounded-md">
            <p className="font-medium">Transcription Result:</p>
            <pre className="whitespace-pre-wrap overflow-auto max-h-40">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        {translatedAudioUrl && (
          <div className="p-4 bg-blue-50 text-blue-800 rounded-md">
            <p className="font-medium mb-2">Translated Audio:</p>
            <audio ref={translatedAudioRef} src={translatedAudioUrl} controls className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
