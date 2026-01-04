import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocalData } from '@/lib/local-data'
import { generateScript, generateEpisodeTitle } from '@/lib/script-generator'
import { generateAndUploadAudio } from '@/lib/tts'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { location, topics = [], neighborhoodName = 'the neighborhood' } = body

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    // Create pending episode
    const episode = await prisma.episode.create({
      data: {
        title: generateEpisodeTitle(location),
        location,
        script: '',
        status: 'generating',
        topics: topics,
      },
    })

    try {
      // Step 1: Fetch local data
      console.log('Fetching local data for:', location)
      const localData = await getLocalData(location)

      // Step 2: Generate script
      console.log('Generating script...')
      const script = await generateScript(localData, location, topics, neighborhoodName)

      // Step 3: Generate audio
      console.log('Generating audio...')
      const { url, duration } = await generateAndUploadAudio(script, episode.id)

      // Step 4: Update episode
      const updatedEpisode = await prisma.episode.update({
        where: { id: episode.id },
        data: {
          script,
          audioUrl: url,
          duration,
          localData: localData as object,
          status: 'completed',
        },
      })

      console.log('Episode generated:', updatedEpisode.id)
      return NextResponse.json({ success: true, episode: updatedEpisode })
    } catch (error) {
      await prisma.episode.update({
        where: { id: episode.id },
        data: { status: 'failed' },
      })
      throw error
    }
  } catch (error) {
    console.error('Episode generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate episode', details: String(error) },
      { status: 500 }
    )
  }
}
