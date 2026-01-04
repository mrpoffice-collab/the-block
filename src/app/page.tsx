'use client'

import { useState, useEffect, useRef } from 'react'

interface Episode {
  id: string
  title: string
  date: string
  location: string
  audioUrl: string | null
  duration: number | null
  topics: string[] | null
}

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)

  // Form state
  const [location, setLocation] = useState('')
  const [topicInput, setTopicInput] = useState('')
  const [topics, setTopics] = useState<string[]>([])

  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetchEpisodes()
  }, [])

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

  function addTopic() {
    if (topicInput.trim() && topics.length < 5) {
      setTopics([...topics, topicInput.trim()])
      setTopicInput('')
    }
  }

  function removeTopic(index: number) {
    setTopics(topics.filter((_, i) => i !== index))
  }

  async function generateEpisode() {
    if (!location.trim()) {
      alert('Please enter a location')
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch('/api/episodes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, topics }),
      })
      const data = await res.json()
      if (data.success || data.episode) {
        setTopics([])
        await fetchEpisodes()
      } else {
        alert('Failed to generate: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to generate:', error)
      alert('Failed to generate episode')
    } finally {
      setIsGenerating(false)
    }
  }

  function playEpisode(episode: Episode) {
    setCurrentEpisode(episode)
    setIsPlaying(true)
    setTimeout(() => audioRef.current?.play(), 100)
  }

  function togglePlay() {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100
      setProgress(pct || 0)
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (audioRef.current) {
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
          <p className="text-amber-700">Your neighborhood, but make it funny</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Generator Form */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-lg border border-amber-200">
          <h2 className="text-lg font-semibold text-amber-900 mb-4">Create Today&apos;s Episode</h2>

          {/* Location */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Austin, TX or 90210"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Topics */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What&apos;s happening in the neighborhood? (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                placeholder="e.g., Gary's inflatable snowman, new taco truck"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={addTopic}
                disabled={topics.length >= 5}
                className="rounded-lg bg-amber-100 px-4 py-2 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
              >
                Add
              </button>
            </div>

            {/* Topic Pills */}
            {topics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {topics.map((topic, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800"
                  >
                    {topic}
                    <button
                      onClick={() => removeTopic(i)}
                      className="ml-1 text-amber-600 hover:text-amber-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={generateEpisode}
            disabled={isGenerating || !location.trim()}
            className="w-full rounded-lg bg-amber-600 py-3 font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Maria & Tina are recording...
              </span>
            ) : (
              '🎙️ Generate Episode'
            )}
          </button>
        </div>

        {/* Current Player */}
        {currentEpisode && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-lg border border-amber-200">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-amber-900">{currentEpisode.title}</h2>
              <p className="text-sm text-amber-700">{currentEpisode.location}</p>
            </div>

            {currentEpisode.audioUrl ? (
              <>
                <audio
                  ref={audioRef}
                  src={currentEpisode.audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />

                <div
                  className="mb-4 h-2 cursor-pointer rounded-full bg-amber-100"
                  onClick={handleSeek}
                >
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center gap-4">
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
                    Duration: {formatDuration(currentEpisode.duration)}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-500 italic">Audio not available</p>
            )}
          </div>
        )}

        {/* Episodes List */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-amber-900">Recent Episodes</h3>
          {isLoading ? (
            <div className="text-center py-8 text-amber-700">Loading episodes...</div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-8 text-amber-700">
              No episodes yet. Create your first one above!
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  onClick={() => playEpisode(episode)}
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
        <p>The Block - Two friends, one neighborhood, infinite gossip</p>
      </footer>
    </div>
  )
}
