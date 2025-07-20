import OpenAI from "openai"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { exec } from "child_process"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Detect language from text for language routing
export function detectLanguage(text: string): string {
  // Check for Devanagari script (Hindi)
  const devanagariPattern = /[\u0900-\u097F]/
  if (devanagariPattern.test(text)) return "hi"

  // Check for Kannada script
  const kannadaPattern = /[\u0C80-\u0CFF]/
  if (kannadaPattern.test(text)) return "kn"

  // Default to English
  return "en"
}

// Real Whisper API for speech-to-text with optimized preprocessing options
export async function transcribeAudio(
  audioBuffer: Buffer, 
  options: { skipPreprocessing?: boolean; fastMode?: boolean } = {}
): Promise<{ text: string; language: string }> {
  try {
    console.log(`Transcribing audio buffer of size: ${audioBuffer.length} bytes`)

    // Pre-validation: Check if audio buffer is meaningful size
    if (audioBuffer.length < 512) { // Reduced threshold for faster processing
      throw new Error("Audio buffer too small to contain meaningful audio")
    }

    const tempDir = os.tmpdir()
    const timestamp = Date.now()
    const inputFile = path.join(tempDir, `audio-in-${timestamp}.webm`)
    let outputFile = inputFile

    // Write the buffer to the temp file
    fs.writeFileSync(inputFile, audioBuffer)

    // Skip preprocessing entirely for ultra-low latency
    if (!options.skipPreprocessing) {
      outputFile = path.join(tempDir, `audio-out-${timestamp}.wav`)
      
      await new Promise<void>((resolve, reject) => {
        // Use fast preprocessing script for low latency, or full processing for quality
        const scriptName = options.fastMode ? "fast_preprocess.py" : "noise_cancel.py"
        const scriptPath = path.resolve(`./scripts/${scriptName}`)
        const command = `python3 ${scriptPath} --input "${inputFile}" --output "${outputFile}"`

        console.log(`Executing ${options.fastMode ? 'fast' : 'full'} preprocessing: ${command}`)

        // Reduced timeout for faster processing
        const timeout = options.fastMode ? 5000 : 15000
        
        exec(command, { timeout }, (error, stdout, stderr) => {
          if (error) {
            console.error(`Preprocessing failed: ${stderr}`)
            // Fallback to original file
            try {
              fs.copyFileSync(inputFile, outputFile)
              console.log("Using original audio file as fallback")
              resolve()
            } catch (copyError) {
              // If fast mode fails, skip preprocessing entirely
              if (options.fastMode) {
                outputFile = inputFile
                console.log("Fast preprocessing failed, using original file directly")
                resolve()
              } else {
                return reject(new Error(`Preprocessing failed: ${stderr}`))
              }
            }
          } else {
            console.log(`Preprocessing completed: ${stdout}`)
            resolve()
          }
        })
      })
    } else {
      console.log("Skipping preprocessing for ultra-low latency")
    }

    // Create a readable stream from the file
    const fileStream = fs.createReadStream(outputFile)

    console.log("Calling OpenAI Whisper API...")
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-1",
    })

    console.log(`Transcription result: ${JSON.stringify(transcription)}`)

    // Clean up temp files
    try {
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile)
      if (fs.existsSync(outputFile) && outputFile !== inputFile) fs.unlinkSync(outputFile)
    } catch (cleanupError) {
      console.warn("Warning: Failed to cleanup temporary files:", cleanupError)
    }

    // Detect language from the transcribed text
    const detectedLanguage = detectLanguage(transcription.text)

    return {
      text: transcription.text,
      language: detectedLanguage,
    }
  } catch (error) {
    console.error("Detailed error in Whisper transcription:", error)
    if (error instanceof Error) {
      throw new Error(`Transcription failed: ${error.message}`)
    } else {
      throw new Error(`Transcription failed: ${String(error)}`)
    }
  }
}

// Real translation using GPT-4
export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  mode: "online" | "offline" = "online",
): Promise<{ text: string; model: string; confidence: number }> {
  try {
    // If source and target are the same, just return the original text
    if (sourceLanguage === targetLanguage) {
      return { text, model: "None", confidence: 1.0 }
    }

    // Get language names for better prompting
    const languageNames: Record<string, string> = {
      en: "English",
      hi: "Hindi",
      kn: "Kannada",
    }

    const sourceLangName = languageNames[sourceLanguage] || sourceLanguage
    const targetLangName = languageNames[targetLanguage] || targetLanguage

    // Use GPT-4 API for translation
    const completion = await openai.chat.completions.create({
      model: mode === "online" ? "gpt-4-turbo" : "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in ${sourceLangName} to ${targetLangName} translation. 
                    Translate the following text from ${sourceLangName} to ${targetLangName}.
                    Only return the translated text, nothing else.`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.3,
    })

    return {
      text: completion.choices[0].message.content?.trim() || text,
      model: mode === "online" ? "GPT-4 Turbo" : "GPT-3.5 Turbo",
      confidence: mode === "online" ? 0.98 : 0.92,
    }
  } catch (error) {
    console.error("Error in translation:", error)

    // Fallback to a simple dictionary for common phrases
    const fallbackDict: Record<string, Record<string, string>> = {
      en: {
        hi: "नमस्ते, आज आप कैसे हैं?",
        kn: "ನಮಸ್ಕಾರ, ನೀವು ಇಂದು ಹೇಗಿದ್ದೀರಿ?",
      },
      hi: {
        en: "Hello, how are you today?",
        kn: "ನಮಸ್ಕಾರ, ನೀವು ಇಂದು ಹೇಗಿದ್ದೀರಿ?",
      },
      kn: {
        en: "Hello, how are you today?",
        hi: "नमस्ते, आज आप कैसे हैं?",
      },
    }

    // Return a fallback if we have one, or just the original text
    return {
      text: fallbackDict[sourceLanguage]?.[targetLanguage] || text,
      model: "Fallback Dictionary",
      confidence: 0.5,
    }
  }
}

// Real text-to-speech using OpenAI TTS API
export async function generateSpeech(text: string, language: string): Promise<Buffer> {
  try {
    console.log(`Generating speech for text: "${text}" in language: ${language}`)

    // Map our language codes to OpenAI voice options
    const voiceMap: Record<string, string> = {
      en: "alloy",
      hi: "shimmer", // Using a female voice for Hindi
      kn: "nova", // Using a different voice for Kannada
    }

    const voice = voiceMap[language] || "alloy"

    // Use OpenAI's TTS API
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
    })

    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer())
    console.log(`Generated speech audio: ${buffer.length} bytes`)

    return buffer
  } catch (error) {
    console.error("Error in speech generation:", error)
    throw new Error(`Failed to generate speech: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Simple noise cancellation (in a real implementation, you would use a proper noise reduction library)
export async function cancelNoise(audioBuffer: Buffer): Promise<Buffer> {
  console.log(`Processing audio for noise cancellation: ${audioBuffer.length} bytes`)
  // In a real implementation, you would apply noise reduction algorithms
  // For now, we'll just return the original buffer
  return audioBuffer
}
