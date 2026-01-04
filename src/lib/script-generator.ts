import Anthropic from '@anthropic-ai/sdk'
import { LocalData, formatLocalDataForScript } from './local-data'

function getClient() {
  return new Anthropic()
}

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

TARGET LENGTH: EXACTLY 8-10 lines of dialogue total. About 45-60 seconds when spoken. Be CONCISE.

Remember: If there's no laughter, it doesn't work. These women genuinely enjoy each other and find their neighborhood hilarious.`

export interface DialogueLine {
  speaker: 'MESCHELLE' | 'KIM'
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
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 800,
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
  const regex = /^(MESCHELLE|KIM):\s*(.+)$/gm

  let match
  while ((match = regex.exec(script)) !== null) {
    const speaker = match[1] as 'MESCHELLE' | 'KIM'
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
