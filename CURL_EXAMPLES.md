# API Testing with cURL

## Testing the Speech-to-Text API

Make sure you have a valid WAV file for testing. Here's how to properly send it:

\`\`\`bash
# Make sure the file path is correct
curl -X POST http://localhost:3000/api/speech-to-text \
  -H "Content-Type: audio/wav" \
  --data-binary @path/to/your/audio.wav
\`\`\`

Note: The `@` symbol before the file path is important - it tells curl to send the file contents.

## Testing the Translation API

\`\`\`bash
curl -X POST http://localhost:3000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, how are you?","sourceLanguage":"en","targetLanguage":"hi","mode":"online"}'
\`\`\`

## Testing the Text-to-Speech API

\`\`\`bash
curl -X POST http://localhost:3000/api/text-to-speech \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, how are you?","language":"en"}' \
  --output speech.mp3
\`\`\`

## Testing the Debug Audio Endpoint

\`\`\`bash
curl -X POST http://localhost:3000/api/test-audio \
  -H "Content-Type: audio/wav" \
  --data-binary @path/to/your/audio.wav
