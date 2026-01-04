import Anthropic from '@anthropic-ai/sdk'
import { LocalData, formatLocalDataForScript } from './local-data'

function getClient() {
  return new Anthropic()
}

const SYSTEM_PROMPT = `You are a comedy writer creating a script for a neighborhood podcast called "The Block."

THE HOSTS:
- MARIA: Quick-witted, slightly sarcastic, asks the follow-up questions everyone is thinking
- TINA: Warm, gossipy, knows everyone's business, easily amused

THE FORMAT:
This is two best friends having coffee/wine and catching up on neighborhood happenings. They've lived here for years and know all the characters.

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
Each line must start with "MARIA:" or "TINA:"
Put reactions in asterisks: *laughing*, *snorts*, *sighs*

EXAMPLE:
MARIA: Okay so I saw Gary out there at 6 AM again. With the ruler.
TINA: *laughing* No. Measuring his grass?
MARIA: Measuring. His. Grass. In January.
TINA: That man has issues and I respect it honestly.
MARIA: *snorts* The dedication is unmatched. Anyway, did you see the thing about the new stop sign?
TINA: Oh my god, the Facebook comments on that were WILD.

TARGET LENGTH: About 3-4 minutes when spoken (roughly 450-600 words)

Remember: If there's no laughter, it doesn't work. These women genuinely enjoy each other and find their neighborhood hilarious.`

export interface DialogueLine {
  speaker: 'MARIA' | 'TINA'
  text: string
  hasReaction: boolean
}

export async function generateScript(
  localData: LocalData,
  location: string,
  userTopics: string[],
  neighborhoodName: string = 'the neighborhood'
): Promise<string> {
  const formattedData = formatLocalDataForScript(localData, location, userTopics)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Write today's episode of "The Block" for ${today}.

The neighborhood: ${neighborhoodName} in ${location}

Here's what's happening:

${formattedData}

Create a funny, natural conversation between Maria and Tina covering this content. Make it feel like two friends genuinely catching up and finding humor in everyday neighborhood life.

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

export function parseScript(script: string): DialogueLine[] {
  const lines: DialogueLine[] = []
  const regex = /^(MARIA|TINA):\s*(.+)$/gm

  let match
  while ((match = regex.exec(script)) !== null) {
    const speaker = match[1] as 'MARIA' | 'TINA'
    const text = match[2].trim()
    const hasReaction = /\*[^*]+\*/.test(text)

    lines.push({ speaker, text, hasReaction })
  }

  return lines
}

export function generateEpisodeTitle(location: string): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return `The Block - ${today}`
}
