export interface LocalData {
  weather: WeatherData | null
  news: NewsItem[]
  events: EventItem[]
  generatedAt: string
}

export interface WeatherData {
  temp: number
  condition: string
  high: number
  low: number
  humidity: number
  description: string
}

export interface NewsItem {
  title: string
  source: string
  url: string
}

export interface EventItem {
  name: string
  date: string
  venue: string
}

export async function getLocalData(location: string): Promise<LocalData> {
  const [weather, news] = await Promise.all([
    getWeather(location),
    getLocalNews(location),
  ])

  return {
    weather,
    news,
    events: [], // Would need Eventbrite API key
    generatedAt: new Date().toISOString(),
  }
}

async function getWeather(location: string): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) {
    console.log('No OpenWeather API key, using mock weather')
    return getMockWeather()
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=imperial&appid=${apiKey}`
    )

    if (!response.ok) {
      console.error('Weather API error:', response.status)
      return getMockWeather()
    }

    const data = await response.json()
    return {
      temp: Math.round(data.main.temp),
      condition: data.weather[0].main,
      high: Math.round(data.main.temp_max),
      low: Math.round(data.main.temp_min),
      humidity: data.main.humidity,
      description: data.weather[0].description,
    }
  } catch (error) {
    console.error('Weather fetch error:', error)
    return getMockWeather()
  }
}

function getMockWeather(): WeatherData {
  // Return seasonal mock data
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
  // Use Google News RSS feed filtered by location
  try {
    const query = encodeURIComponent(location + ' local news')
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`

    const response = await fetch(rssUrl)
    if (!response.ok) {
      console.error('News fetch error:', response.status)
      return getMockNews(location)
    }

    const text = await response.text()
    const items: NewsItem[] = []

    // Simple XML parsing for RSS
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || []

    for (const item of itemMatches.slice(0, 5)) {
      const titleMatch = item.match(/<title>(.*?)<\/title>/)
      const linkMatch = item.match(/<link>(.*?)<\/link>/)
      const sourceMatch = item.match(/<source.*?>(.*?)<\/source>/)

      if (titleMatch) {
        items.push({
          title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          source: sourceMatch ? sourceMatch[1] : 'Local News',
          url: linkMatch ? linkMatch[1] : '',
        })
      }
    }

    return items.length > 0 ? items : getMockNews(location)
  } catch (error) {
    console.error('News fetch error:', error)
    return getMockNews(location)
  }
}

function getMockNews(location: string): NewsItem[] {
  return [
    { title: `City council debates new parking regulations in downtown ${location}`, source: 'Local Tribune', url: '' },
    { title: 'Local school district announces snow day policy for winter', source: 'Education Weekly', url: '' },
    { title: 'New coffee shop opening draws crowds on Main Street', source: 'Business Journal', url: '' },
  ]
}

export function formatLocalDataForScript(data: LocalData, location: string, userTopics: string[]): string {
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
