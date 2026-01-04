'use client'

import { useState, useEffect, useRef } from 'react'

interface Episode {
  id: string
  title: string
  date: string
  location: string
  script: string | null
  audioUrl: string | null
  duration: number | null
}

interface DialogueLine {
  speaker: 'MESCHELLE' | 'KIM'
  text: string
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

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([])
  const [audioProgress, setAudioProgress] = useState(0)

  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetchEpisodes()
  }, [])

  useEffect(() => {
    if (currentEpisode?.script) {
      const lines = parseScript(currentEpisode.script)
      setDialogueLines(lines)
    } else {
      setDialogueLines([])
    }
  }, [currentEpisode])

  async function fetchEpisodes() {
    try {
      const res = await fetch('/api/episodes')
      const data = await res.json()
      setEpisodes(data.episodes || [])
      if (data.episodes?.length > 0) {
        setCurrentEpisode(data.episodes[0])
      }
    } catch (error) {
      console.error('Failed to fetch episodes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function selectEpisode(episode: Episode) {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsPlaying(false)
    setCurrentEpisode(episode)
    setAudioProgress(0)
  }

  function togglePlay() {
    if (currentEpisode?.audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  function handleAudioTimeUpdate() {
    if (audioRef.current && audioRef.current.duration) {
      setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)
    }
  }

  function handleAudioSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (audioRef.current && audioRef.current.duration) {
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = (e.clientX - rect.left) / rect.width
      audioRef.current.currentTime = pct * audioRef.current.duration
    }
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 text-gray-900">
      {/* Header */}
      <header className="border-b border-amber-200 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight text-amber-900">The Block</h1>
          <p className="text-amber-700">Two friends, one neighborhood, infinite gossip</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Current Player */}
        {currentEpisode ? (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg border border-amber-200">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-amber-900">{currentEpisode.title}</h2>
              <p className="text-sm text-amber-700">{currentEpisode.location} • {formatDate(currentEpisode.date)}</p>
            </div>

            {currentEpisode.audioUrl ? (
              <>
                <audio
                  ref={audioRef}
                  src={currentEpisode.audioUrl}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />

                {/* Progress bar */}
                <div
                  className="mb-4 h-2 cursor-pointer rounded-full bg-amber-100"
                  onClick={handleAudioSeek}
                >
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>

                {/* Play Controls */}
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={togglePlay}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-600 text-white transition hover:bg-amber-500"
                  >
                    {isPlaying ? (
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <div className="text-sm text-amber-700">
                    {formatDuration(currentEpisode.duration)}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-amber-600 italic mb-4">Audio generating...</p>
            )}

            {/* Script Display */}
            {dialogueLines.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg bg-amber-50 p-4 space-y-2">
                {dialogueLines.map((line, i) => (
                  <div key={i} className="p-2 rounded">
                    <span className={`font-bold ${line.speaker === 'MESCHELLE' ? 'text-rose-700' : 'text-violet-700'}`}>
                      {line.speaker}:
                    </span>{' '}
                    <span className="text-gray-800">{line.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !isLoading ? (
          <div className="mb-8 rounded-xl bg-white p-8 shadow-lg border border-amber-200 text-center">
            <p className="text-amber-700 text-lg">No episodes yet. Check back soon!</p>
          </div>
        ) : null}

        {/* Episodes List */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-amber-900">All Episodes</h3>
          {isLoading ? (
            <div className="text-center py-8 text-amber-700">Loading episodes...</div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-8 text-amber-700">
              No episodes available yet.
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  onClick={() => selectEpisode(episode)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg p-4 transition ${
                    currentEpisode?.id === episode.id
                      ? 'bg-amber-100 border-2 border-amber-400'
                      : 'bg-white hover:bg-amber-50 border border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      currentEpisode?.id === episode.id ? 'bg-amber-500' : 'bg-amber-100'
                    }`}>
                      {currentEpisode?.id === episode.id && isPlaying ? (
                        <div className="flex gap-0.5">
                          <span className="w-1 h-4 bg-white animate-pulse" />
                          <span className="w-1 h-4 bg-white animate-pulse delay-75" />
                          <span className="w-1 h-4 bg-white animate-pulse delay-150" />
                        </div>
                      ) : (
                        <svg className={`h-4 w-4 ${currentEpisode?.id === episode.id ? 'text-white' : 'text-amber-600'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-amber-900">{episode.title}</p>
                      <p className="text-sm text-amber-600">{episode.location} • {formatDate(episode.date)}</p>
                    </div>
                  </div>
                  <div className="text-sm text-amber-600">
                    {formatDuration(episode.duration)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-200 py-6 text-center text-sm text-amber-700">
        <p>The Block - New episodes daily at 6 AM</p>
      </footer>
    </div>
  )
}
