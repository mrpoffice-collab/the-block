import OpenAI from 'openai'
import { put } from '@vercel/blob'
import { parseScript } from './script-generator'

function getOpenAI() {
  return new OpenAI()
}

// Voice assignments
const VOICES = {
  MARIA: 'nova' as const,   // Friendly, upbeat - the quick-witted one
  TINA: 'shimmer' as const, // Soft, warm - the gossipy one
}

export async function synthesizeDialogue(script: string): Promise<Buffer[]> {
  const lines = parseScript(script)
  const audioBuffers: Buffer[] = []

  for (const line of lines) {
    // Clean the text - remove reaction markers for TTS but keep natural speech
    let text = line.text
      .replace(/\*laughing\*/gi, 'ha ha!')
      .replace(/\*snorts\*/gi, 'pfft!')
      .replace(/\*gasps\*/gi, '')
      .replace(/\*sighs\*/gi, '')
      .replace(/\*[^*]+\*/g, '') // Remove other reactions
      .trim()

    if (!text) continue

    const voice = VOICES[line.speaker]
    const buffer = await synthesizeLine(text, voice)
    audioBuffers.push(buffer)
  }

  return audioBuffers
}

async function synthesizeLine(
  text: string,
  voice: 'nova' | 'shimmer'
): Promise<Buffer> {
  const openai = getOpenAI()
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice,
    input: text,
    response_format: 'mp3',
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function assembleAudio(audioBuffers: Buffer[]): Promise<Buffer> {
  // Simple concatenation - each buffer is already an MP3
  // For production, you'd want proper audio processing with ffmpeg
  // But for MVP, we'll concatenate the raw buffers

  // Calculate total size
  const totalSize = audioBuffers.reduce((acc, buf) => acc + buf.length, 0)
  const combined = Buffer.concat(audioBuffers, totalSize)

  return combined
}

export async function generateAndUploadAudio(
  script: string,
  episodeId: string
): Promise<{ url: string; duration: number }> {
  // Generate audio for each line
  const audioBuffers = await synthesizeDialogue(script)

  // Assemble into single file
  const finalAudio = await assembleAudio(audioBuffers)

  // Estimate duration (rough: count words in script / 150 words per minute)
  const wordCount = script.split(/\s+/).length
  const estimatedDuration = Math.round((wordCount / 150) * 60)

  // Upload to Vercel Blob
  const filename = `episodes/${episodeId}.mp3`
  const blob = await put(filename, finalAudio, {
    access: 'public',
    contentType: 'audio/mpeg',
  })

  return { url: blob.url, duration: estimatedDuration }
}
