import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const episodes = await prisma.episode.findMany({
      where: { status: 'completed' },
      orderBy: { date: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        script: true,
        audioUrl: true,
        duration: true,
        topics: true,
      },
    })

    return NextResponse.json({ episodes })
  } catch (error) {
    console.error('Failed to fetch episodes:', error)
    return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 })
  }
}
