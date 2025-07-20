import { type NextRequest, NextResponse } from "next/server"
import { transcribeAudio } from "@/lib/ai-utils"

export async function POST(request: NextRequest) {
  try {
    console.log("Received speech-to-text request")

    // Check if we have a valid request with audio data
    if (!request.body) {
      return NextResponse.json({ error: "No audio data provided" }, { status: 400 })
    }

    // Check for processing mode in headers
    const processingMode = request.headers.get("x-processing-mode") || "fast"
    const skipPreprocessing = request.headers.get("x-skip-preprocessing") === "true"
    
    console.log(`Processing mode: ${processingMode}, Skip preprocessing: ${skipPreprocessing}`)

    const audioData = await request.blob()
    console.log(`Audio blob received: ${audioData.size} bytes, type: ${audioData.type}`)

    if (audioData.size === 0) {
      return NextResponse.json({ error: "Empty audio data" }, { status: 400 })
    }

    // Convert blob to buffer
    const audioBuffer = Buffer.from(await audioData.arrayBuffer())
    console.log(`Audio buffer size: ${audioBuffer.length} bytes`)

    // Transcribe with optimized settings for low latency
    const options = {
      skipPreprocessing: skipPreprocessing,
      fastMode: processingMode === "fast"
    }

    const { text, language } = await transcribeAudio(audioBuffer, options)
    console.log(`Transcription successful: "${text}" (${language})`)

    return NextResponse.json({
      text,
      language,
      confidence: 0.95,
      processingMode,
    })
  } catch (error) {
    console.error("Error in speech-to-text:", error)
    return NextResponse.json(
      {
        error: "Failed to transcribe audio",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
