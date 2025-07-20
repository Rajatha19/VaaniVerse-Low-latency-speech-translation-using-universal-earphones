import { type NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export async function POST(request: NextRequest) {
  try {
    // Get the audio data from the request
    const audioData = await request.blob()
    console.log(`Test endpoint received audio blob: ${audioData.size} bytes, type: ${audioData.type}`)

    const audioBuffer = Buffer.from(await audioData.arrayBuffer())
    console.log(`Converted to buffer: ${audioBuffer.length} bytes`)

    // Save the audio to a temporary file for inspection
    const tempDir = os.tmpdir()
    const tempFile = path.join(tempDir, `debug-audio-${Date.now()}.webm`)
    fs.writeFileSync(tempFile, audioBuffer)
    console.log(`Saved audio to ${tempFile}`)

    // Return success with detailed information
    return NextResponse.json({
      success: true,
      message: "Audio received and saved for debugging",
      size: audioBuffer.length,
      path: tempFile,
      type: audioData.type,
      tempDir: tempDir,
      nodeVersion: process.version,
      platform: process.platform,
    })
  } catch (error) {
    console.error("Error in test-audio endpoint:", error)
    return NextResponse.json(
      {
        error: "Failed to process audio",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
