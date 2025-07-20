import { type NextRequest, NextResponse } from "next/server"
import { generateSpeech } from "@/lib/ai-utils"

export async function POST(request: NextRequest) {
  try {
    const { text, language } = await request.json()
    console.log(`Text-to-speech request: "${text}" in ${language}`)

    // Generate speech using OpenAI TTS
    const audioBuffer = await generateSpeech(text, language)

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
      },
    })
  } catch (error) {
    console.error("Error in text-to-speech:", error)
    return NextResponse.json(
      {
        error: "Failed to generate speech",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
