import { type NextRequest, NextResponse } from "next/server"
import { translateText } from "@/lib/ai-utils"

export async function POST(request: NextRequest) {
  try {
    const { text, sourceLanguage, targetLanguage, mode } = await request.json()
    console.log(`Translation request: "${text}" from ${sourceLanguage} to ${targetLanguage} (mode: ${mode})`)

    // Translate the text using GPT
    const {
      text: translatedText,
      model,
      confidence,
    } = await translateText(text, sourceLanguage, targetLanguage, mode as "online" | "offline")

    console.log(`Translation result: "${translatedText}" (model: ${model}, confidence: ${confidence})`)

    return NextResponse.json({
      text: translatedText,
      model,
      confidence,
    })
  } catch (error) {
    console.error("Error in translation:", error)
    return NextResponse.json(
      {
        error: "Failed to translate text",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
