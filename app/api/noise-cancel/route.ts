import { type NextRequest, NextResponse } from "next/server"
import { cancelNoise } from "@/lib/ai-utils"

export async function POST(request: NextRequest) {
  try {
    const audioData = await request.blob()
    console.log(`Noise cancellation request: ${audioData.size} bytes`)

    const audioBuffer = Buffer.from(await audioData.arrayBuffer())

    // Process the audio with our mock function
    const processedBuffer = await cancelNoise(audioBuffer)

    return new NextResponse(processedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
      },
    })
  } catch (error) {
    console.error("Error in noise cancellation:", error)
    return NextResponse.json({ error: "Failed to process audio" }, { status: 500 })
  }
}
