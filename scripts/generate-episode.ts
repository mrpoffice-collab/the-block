import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { put } from '@vercel/blob'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const anthropic = new Anthropic()
const openai = new OpenAI()

// ============ CONFIGURATION ============
const CONFIG = {
  location: process.argv[2] || 'Austin, TX',
  topics: process.argv.slice(3),
  neighborhoodName: 'the neighborhood',
}

// ============ TYPES ============
interface LocalData {
  weather: WeatherData | null
  news: NewsItem[]
  generatedAt: string
}

interface WeatherData {
  temp: number
  condition: string
  high: number
  low: number
  humidity: number
  description: string
}

interface NewsItem {
  title: string
  source: string
}

interface DialogueLine {
  speaker: 'MESCHELLE' | 'KIM'
  text: string
}

// ============ VOICE CONFIG ============
const VOICES = {
  MESCHELLE: 'nova' as const,
  KIM: 'shimmer' as const,
}

// ============ PROMPTS ============
const SYSTEM_PROMPT = `You are a comedy writer creating a script for a neighborhood podcast called "The Block."

THE HOSTS:
- MESCHELLE: Quick-witted, playful humor, asks the follow-up questions everyone is thinking
- KIM: Quick-witted, warm, knows everyone's business, finds joy in the absurdity of everyday life

THE FORMAT:
This is two best friends having coffee/wine and catching up on neighborhood happenings. They've lived here for years and know all the characters. Both have sharp, playful humor - they riff off each other naturally.

CRITICAL RULES:
1. Write as natural dialogue - contractions, interruptions, trailing off...
2. Include laughter and reactions: *laughing*, *snorts*, *gasps*, *sighs*
3. React to absurdity naturally: "Wait, WHAT?", "Oh no...", "Of course he did"
4. Reference recurring neighborhood characters (make them up): Gary with his lawn obsession, Helen who knows everyone's business, the guy who's always working on his car, etc.
5. Use "anyway..." to transition between topics
6. Include at least 3-4 genuine laugh moments per episode
7. Keep it PG-13 - no explicit content but mild gossip is fine
8. End with a callback or running joke

DIALOGUE FORMAT:
Each line must start with "MESCHELLE:" or "KIM:"
Put reactions in asterisks: *laughing*, *snorts*, *sighs*

EXAMPLE:
MESCHELLE: Okay so I saw Gary out there at 6 AM again. With the ruler.
KIM: *laughing* No. Measuring his grass?
MESCHELLE: Measuring. His. Grass. In January.
KIM: That man has issues and I respect it honestly.
MESCHELLE: *snorts* The dedication is unmatched. Anyway, did you see the thing about the new stop sign?
KIM: Oh my god, the Facebook comments on that were WILD.

TARGET LENGTH: About 3-4 minutes when spoken (roughly 450-600 words).

Remember: If there's no laughter, it doesn't work. These women genuinely enjoy each other and find their neighborhood hilarious.`

// ============ DATA FETCHING ============
async function getWeather(location: string): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) {
    console.log('  No OpenWeather API key, using mock weather')
    return getMockWeather()
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=imperial&appid=${apiKey}`
    )
    if (!response.ok) return getMockWeather()

    const data = await response.json()
    return {
      temp: Math.round(data.main.temp),
      condition: data.weather[0].main,
      high: Math.round(data.main.temp_max),
      low: Math.round(data.main.temp_min),
      humidity: data.main.humidity,
      description: data.weather[0].description,
    }
  } catch {
    return getMockWeather()
  }
}

function getMockWeather(): WeatherData {
  const month = new Date().getMonth()
  const isWinter = month >= 11 || month <= 2
  const isSummer = month >= 5 && month <= 8

  return {
    temp: isWinter ? 35 : isSummer ? 85 : 65,
    condition: isWinter ? 'Cloudy' : isSummer ? 'Sunny' : 'Partly Cloudy',
    high: isWinter ? 40 : isSummer ? 90 : 70,
    low: isWinter ? 28 : isSummer ? 72 : 55,
    humidity: 60,
    description: isWinter ? 'overcast clouds' : isSummer ? 'clear sky' : 'scattered clouds',
  }
}

async function getLocalNews(location: string): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(location + ' local news')
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`

    const response = await fetch(rssUrl)
    if (!response.ok) return getMockNews(location)

    const text = await response.text()
    const items: NewsItem[] = []
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || []

    for (const item of itemMatches.slice(0, 5)) {
      const titleMatch = item.match(/<title>(.*?)<\/title>/)
      const sourceMatch = item.match(/<source.*?>(.*?)<\/source>/)

      if (titleMatch) {
        items.push({
          title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          source: sourceMatch ? sourceMatch[1] : 'Local News',
        })
      }
    }

    return items.length > 0 ? items : getMockNews(location)
  } catch {
    return getMockNews(location)
  }
}

function getMockNews(location: string): NewsItem[] {
  return [
    { title: `City council debates new parking regulations in downtown ${location}`, source: 'Local Tribune' },
    { title: 'Local school district announces snow day policy for winter', source: 'Education Weekly' },
    { title: 'New coffee shop opening draws crowds on Main Street', source: 'Business Journal' },
  ]
}

async function getLocalData(location: string): Promise<LocalData> {
  const [weather, news] = await Promise.all([
    getWeather(location),
    getLocalNews(location),
  ])

  return {
    weather,
    news,
    generatedAt: new Date().toISOString(),
  }
}

function formatLocalDataForScript(data: LocalData, location: string, userTopics: string[]): string {
  let content = `Location: ${location}\n`
  content += `Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n\n`

  if (data.weather) {
    content += `WEATHER:\n`
    content += `- Current: ${data.weather.temp}°F, ${data.weather.condition}\n`
    content += `- High: ${data.weather.high}°F, Low: ${data.weather.low}°F\n`
    content += `- ${data.weather.description}\n\n`
  }

  if (data.news.length > 0) {
    content += `LOCAL NEWS:\n`
    for (const item of data.news) {
      content += `- ${item.title} (${item.source})\n`
    }
    content += '\n'
  }

  if (userTopics.length > 0) {
    content += `NEIGHBORHOOD TOPICS (from residents):\n`
    for (const topic of userTopics) {
      content += `- ${topic}\n`
    }
  }

  return content
}

// ============ SCRIPT GENERATION ============
async function generateScript(localData: LocalData, location: string, userTopics: string[]): Promise<string> {
  const formattedData = formatLocalDataForScript(localData, location, userTopics)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Write today's episode of "The Block" for ${today}.

The neighborhood: ${CONFIG.neighborhoodName} in ${location}

Here's what's happening:

${formattedData}

Create a funny, natural conversation between Meschelle and Kim covering this content. Make it feel like two friends genuinely catching up and finding humor in everyday neighborhood life.

Remember:
- Start with a casual greeting/check-in
- Cover the weather briefly (find something funny about it)
- Hit the news/topics with genuine reactions
- Include neighborhood character references
- End with a callback or running joke
- MUST include laughter - if it's not funny, rewrite it until it is`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in response')
  }

  return textContent.text
}

function parseScript(script: string): DialogueLine[] {
  const lines: DialogueLine[] = []
  const regex = /^(MESCHELLE|KIM):\s*(.+)$/gm

  let match
  while ((match = regex.exec(script)) !== null) {
    const speaker = match[1] as 'MESCHELLE' | 'KIM'
    const text = match[2].trim()
    lines.push({ speaker, text })
  }

  return lines
}

// ============ TTS GENERATION ============
async function synthesizeLine(text: string, voice: 'nova' | 'shimmer'): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice,
    input: text,
    response_format: 'mp3',
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function generateAudio(script: string): Promise<{ buffer: Buffer; duration: number }> {
  const lines = parseScript(script)
  console.log(`  Generating TTS for ${lines.length} lines...`)

  // Prepare all lines
  const lineData: { text: string; voice: 'nova' | 'shimmer'; index: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let text = line.text
      .replace(/\*laughing\*/gi, 'ha ha!')
      .replace(/\*snorts\*/gi, 'pfft!')
      .replace(/\*gasps\*/gi, '')
      .replace(/\*sighs\*/gi, '')
      .replace(/\*[^*]+\*/g, '')
      .trim()

    if (!text) continue

    const voice = VOICES[line.speaker]
    lineData.push({ text, voice, index: i })
  }

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5
  const results: { index: number; buffer: Buffer }[] = []

  for (let i = 0; i < lineData.length; i += batchSize) {
    const batch = lineData.slice(i, i + batchSize)
    console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(lineData.length / batchSize)}...`)

    const batchResults = await Promise.all(
      batch.map(async ({ text, voice, index }) => {
        const buffer = await synthesizeLine(text, voice)
        return { index, buffer }
      })
    )
    results.push(...batchResults)
  }

  // Sort by original index and concatenate
  results.sort((a, b) => a.index - b.index)
  const buffers = results.map(r => r.buffer)
  const combined = Buffer.concat(buffers)

  // Estimate duration
  const wordCount = script.split(/\s+/).length
  const estimatedDuration = Math.round((wordCount / 150) * 60)

  return { buffer: combined, duration: estimatedDuration }
}

// ============ UPLOAD & SAVE ============
async function uploadAudio(buffer: Buffer, episodeId: string): Promise<string> {
  const filename = `episodes/${episodeId}.mp3`
  const blob = await put(filename, buffer, {
    access: 'public',
    contentType: 'audio/mpeg',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

function generateEpisodeTitle(location: string): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return `The Block - ${today}`
}

// ============ MAIN ============
async function main() {
  console.log('\n========================================')
  console.log('  THE BLOCK - Episode Generator')
  console.log('========================================\n')
  console.log(`Location: ${CONFIG.location}`)
  console.log(`Topics: ${CONFIG.topics.length > 0 ? CONFIG.topics.join(', ') : '(none)'}`)
  console.log('')

  try {
    // Step 1: Fetch local data
    console.log('[1/5] Fetching local data...')
    const localData = await getLocalData(CONFIG.location)
    console.log(`  Weather: ${localData.weather?.temp}°F, ${localData.weather?.condition}`)
    console.log(`  News items: ${localData.news.length}`)

    // Step 2: Generate script
    console.log('\n[2/5] Generating script with Claude...')
    const script = await generateScript(localData, CONFIG.location, CONFIG.topics)
    const lines = parseScript(script)
    console.log(`  Generated ${lines.length} lines of dialogue`)

    // Step 3: Create episode record
    console.log('\n[3/5] Creating episode record...')
    const episode = await prisma.episode.create({
      data: {
        title: generateEpisodeTitle(CONFIG.location),
        location: CONFIG.location,
        script: script,
        status: 'generating',
        topics: CONFIG.topics,
        localData: localData as object,
      },
    })
    console.log(`  Episode ID: ${episode.id}`)

    // Step 4: Generate audio
    console.log('\n[4/5] Generating audio with OpenAI TTS...')
    const { buffer, duration } = await generateAudio(script)
    console.log(`  Audio size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Estimated duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`)

    // Step 5: Upload and finalize
    console.log('\n[5/5] Uploading to Vercel Blob...')
    const audioUrl = await uploadAudio(buffer, episode.id)
    console.log(`  URL: ${audioUrl}`)

    // Update episode
    await prisma.episode.update({
      where: { id: episode.id },
      data: {
        audioUrl,
        duration,
        status: 'completed',
      },
    })

    console.log('\n========================================')
    console.log('  SUCCESS!')
    console.log('========================================')
    console.log(`Episode "${episode.title}" is ready.`)
    console.log(`Listen at: https://the-block-psi.vercel.app`)
    console.log('')

  } catch (error) {
    console.error('\nERROR:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
