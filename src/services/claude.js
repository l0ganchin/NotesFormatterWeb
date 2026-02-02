// Claude API service for formatting notes

const DEFAULT_TAKEAWAYS_GUIDANCE = `- [First substantive insight about the relationship, how it started, or overall context]
- [Second insight about what they value or the company's strengths]
- [Third insight about challenges, pain points, or areas for improvement]
- [Fourth insight about growth potential, future outlook, or strategic needs]
- [Optional fifth bullet for additional context, e.g., "Feedback should be considered in context: [relevant caveat]"]`

// Detail level descriptions for key takeaways
const DETAIL_LEVEL_INSTRUCTIONS = {
  concise: `- Each bullet should be 1-2 sentences: a clear topic statement with one key supporting point
- Focus only on the core insight—omit examples and extended context`,
  balanced: `- Each bullet should be 2-3 concise sentences: a clear topic statement followed by supporting context or evidence`,
  detailed: `- Each bullet should be 3-4 sentences: a clear topic statement followed by fuller context, specific examples, and implications
- Include relevant quotes, specific figures, and concrete examples where available`,
}

// These style/quality rules are always included and not editable by users
function getFixedTakeawaysRules(detailLevel = 'balanced') {
  const lengthInstruction = DETAIL_LEVEL_INSTRUCTIONS[detailLevel] || DETAIL_LEVEL_INSTRUCTIONS.balanced

  return `**Style & Quality Requirements (always applied):**
- Write 4-5 substantive takeaways (fewer only if the source material genuinely lacks content)
${lengthInstruction}
- Do NOT refer to the respondent by name—use "the client," "the customer," or "the respondent" instead
- Frame everything through a management consulting lens: you are evaluating the health of a vendor relationship or company
- Tone should read like a polished executive brief suitable for sharing with clients, not internal meeting notes
- When competitors, growth percentages, pricing models, or investment areas appear in the source material, prioritize surfacing them
- Be forward-looking where the content supports it: opportunities, growth expectations, capability gaps
- Include distinctive quotes when they capture sentiment well (e.g., "nimble and scrappy," "white-glove whitelisting")
- Surface churn risk, in-housing likelihood, and wallet share dynamics when present in the source material
- Do NOT bold any text within the takeaway bullets themselves
- Use complete sentences with natural clause breaks`
}

function buildQuantInstructions(quantCategories = []) {
  // Post-quant reminder that applies to both modes
  const postQuantReminder = `
**REMINDER - Post-Quantitative Content:**
After completing the quantitative scores, CHECK THE TRANSCRIPT for any remaining questions or discussion.
Common patterns to look for: "Any final thoughts?", "Is there anything else?", "One more question...", "Before we wrap up..."
These MUST be formatted as Discussion questions (triple asterisks for question, bullets for answers).`

  // Manual mode: user specified categories with per-category scales
  if (quantCategories.length > 0) {
    const validCategories = quantCategories.filter(cat => cat.name && cat.name.trim())
    if (validCategories.length > 0) {
      const categoryList = validCategories
        .map((cat, i) => `   ${i + 1}. ${cat.name} (scale: 1-${cat.scale})`)
        .join('\n')

      return `**Quantitative Section:**
- You MUST include this section with the following categories in this exact order:
${categoryList}
- For each category, provide:
   - **Score:** [value] (out of the scale specified for that category)
   - **Reason:** [explanation from interviewee]
- If a category was NOT mentioned or discussed in the transcript/notes, use:
   - **Score:** Not discussed
   - **Reason:** This topic was not covered in the interview
${postQuantReminder}`
    }
  }

  // Auto-detect mode: let Claude figure it out
  return `**Quantitative Section (if applicable):**
- Only include this section if there are quantitative scores/ratings in the notes or transcript
- If no scores are present, omit this section entirely
- Auto-detect the categories being rated and include each with:
   - **Score:** [value] (out of the scale mentioned, or 10 if not specified)
   - **Reason:** [explanation from interviewee]
${postQuantReminder}`
}

function buildTakeawaysInstructions(takeawaysGuidance = '', detailLevel = 'balanced') {
  const trimmedGuidance = takeawaysGuidance.trim()
  const fixedRules = getFixedTakeawaysRules(detailLevel)

  // Manual mode: user provided topical guidance
  if (trimmedGuidance) {
    return `**Topical Guidance (what to cover):**
${trimmedGuidance}

${fixedRules}`
  }

  // Auto mode: use best judgment on topics
  return `**Topical Guidance:**
Use your best judgment to identify the most important themes from the source material. Common themes include: relationship origin, what they value, challenges or pain points, growth potential, and any relevant caveats for interpreting feedback.

${fixedRules}`
}

function buildRespondentInstructions(respondentInfo) {
  if (respondentInfo && (respondentInfo.name || respondentInfo.role || respondentInfo.company)) {
    const parts = []
    if (respondentInfo.name) parts.push(`Name: ${respondentInfo.name}`)
    if (respondentInfo.role) parts.push(`Role: ${respondentInfo.role}`)
    if (respondentInfo.company) parts.push(`Company: ${respondentInfo.company}`)

    return `**Respondent Information (USE THIS - provided by user):**
${parts.join('\n')}

You MUST use this exact information for the title line. Format as: ### [Name], [Role], [Company]
If any field is missing, infer it from the content.`
  }

  return `**Respondent Information:**
Auto-detect the interviewee's name, role/title, and company from the notes and transcript.
Use this for the title line: ### [Name], [Role], [Company]`
}

function buildPrompt(takeawaysGuidance = '', quantCategories = [], detailLevel = 'balanced', respondentInfo = null) {
  const quantInstructions = buildQuantInstructions(quantCategories)
  const takeawaysInstructions = buildTakeawaysInstructions(takeawaysGuidance, detailLevel)
  const respondentInstructions = buildRespondentInstructions(respondentInfo)

  return `You are a professional note formatter for management consulting client interviews. Transform the raw meeting notes and transcript into polished, client-ready documentation.

## CRITICAL: PROCESS THE ENTIRE TRANSCRIPT
**You MUST read and format the ENTIRE transcript from start to finish. Do NOT stop after quantitative scores.**
- Interviews often have questions AFTER the quantitative scoring section (e.g., "Any final thoughts?", "Is there anything else?", "One more question...")
- These post-quantitative questions MUST be included and formatted as Discussion questions
- Scan the ENTIRE transcript before finishing to ensure nothing is missed

## INPUTS
You will receive two attachments:
1. **Raw Meeting Notes** - Bullet points and shorthand from the call
2. **Transcript** - Full conversation transcript (use to fill gaps and ensure completeness)

Review both attachments and synthesize them into a single formatted output.

## OUTPUT FORMAT
You MUST follow these exact markdown conventions for the output to be processed correctly:

---

### [Interviewee Name], [Role], [Company]

**Key Takeaways:**
[4-5 substantive bullet points following the guidance below]

**Discussion:**

***[Question from interviewer – if applicable. It may be best to replace the questions with the topic headers]***
- [Answer point in first person from interviewee's perspective]
- [Additional point if applicable]
- [Continue with all relevant details]

***[Next question]***
- [Answer points...]

[Continue for all discussion topics]

---

## CRITICAL MARKDOWN FORMATTING RULES

You MUST follow these exact formatting conventions:

1. **Title line**: Start with \`### \` followed by Name, Role, Company
   - Example: \`### Alba Mertiera, Co-Founder and CMO, Hone Health\`

2. **Section headers**: Use \`**Text:**\` format (bold with colon)
   - Example: \`**Key Takeaways:**\`
   - Example: \`**Discussion:**\`

3. **Discussion questions**: Wrap in triple asterisks \`***Text***\`
   - Example: \`***What services are you using them for?***\`

4. **All bullet points**: Start with \`- \` (hyphen + space)
   - Example: \`- I have been working with the company for three years\`

5. **CRITICAL - Post-quantitative questions**: Any questions asked AFTER the quantitative scoring section MUST be formatted as Discussion questions. Do NOT omit these.
   - Format the question with triple asterisks: \`***Any final thoughts or feedback?***\`
   - Format answers as bullet points: \`- I think they've been a great partner overall\`
   - Common examples: "Any final thoughts?", "Is there anything else?", "One last question...", "Before we wrap up..."
   - These appear AFTER the quant scores in the output

6. **Quantitative section header**: Use triple asterisks
   - Example: \`***Quantitative Questions: How would you rate [Company]?***\`

7. **Quantitative category names**: Use double asterisks (bold)
   - Example: \`**Overall Satisfaction**\`

8. **Score and Reason labels**: Bold the labels within bullets
   - Example: \`- **Score:** 7 (out of 10)\`
   - Example: \`- **Reason:** They delivered excellent work\`

## STYLE GUIDELINES

**Key Takeaways:**
${takeawaysInstructions}

**Discussion Section:**
- Question headers should be the interviewer's questions (infer from context if needed)
- Answers in first person ("I", "We", "Our") from the interviewee's perspective
- Complete, conversational sentences
- Preserve specific details: company names, dollar figures, percentages, timeframes
- Use brackets for contextual clarifications, e.g., "[TikTok & Snapchat]"

${quantInstructions}

**General:**
- Professional but conversational tone
- Don't over-abbreviate—include all substantive points
- If the interviewee mentions competitors, include them with context
- Preserve any nuance about the relationship trajectory
- Be exhaustive yet concise

${respondentInstructions}`
}

export async function formatNotes(transcript, notes, apiKey, options = {}) {
  const { takeawaysGuidance, quantCategories = [], detailLevel = 'balanced', respondentInfo = null, onChunk } = options
  const systemPrompt = buildPrompt(takeawaysGuidance, quantCategories, detailLevel, respondentInfo)

  const userMessage = `## RAW MEETING NOTES
${notes}

## TRANSCRIPT
${transcript}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      stream: true,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to format notes')
  }

  // Handle streaming response
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)

          // Handle content_block_delta events
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text
            if (onChunk) {
              onChunk(fullText)
            }
          }
        } catch (e) {
          // Ignore parsing errors for incomplete JSON
        }
      }
    }
  }

  return fullText
}

// Parse output to extract detected quant categories (for auto-fill feature)
// Returns objects with { name, scale } structure
export function parseQuantCategories(output) {
  const categories = []
  const lines = output.split('\n')

  let inQuantSection = false
  let currentCategory = null
  let currentScale = 10 // default scale

  for (const line of lines) {
    // Detect quant section start
    if (line.includes('Quantitative') && (line.includes('***') || line.includes('**'))) {
      inQuantSection = true
      continue
    }

    // Detect section end (next major section or end)
    if (inQuantSection && (line.startsWith('**') && line.endsWith(':**') && !line.includes('Score') && !line.includes('Reason'))) {
      break
    }

    if (!inQuantSection) continue

    // Category name (bold text on its own line)
    if (line.startsWith('**') && line.endsWith('**') && !line.includes('Score') && !line.includes('Reason')) {
      currentCategory = line.replace(/\*\*/g, '').trim()
      currentScale = 10 // reset to default
      continue
    }

    // Score line - extract scale from "out of X" pattern and confirm category
    if (line.includes('**Score:**') && currentCategory) {
      // Try to detect scale from "out of X" pattern
      const scaleMatch = line.match(/out of (\d+)/i)
      if (scaleMatch) {
        currentScale = parseInt(scaleMatch[1], 10) || 10
      }
      categories.push({ name: currentCategory, scale: currentScale })
      currentCategory = null
    }
  }

  return categories
}

// Parse output to extract respondent info (name, role, company) from the title line
export function parseRespondentInfo(output) {
  const info = { name: '', role: '', company: '' }

  // Look for the title line: ### Name, Role, Company
  const lines = output.split('\n')
  for (const line of lines) {
    if (line.startsWith('### ')) {
      const titleContent = line.slice(4).trim()
      // Split by comma, expecting "Name, Role, Company"
      const parts = titleContent.split(',').map(p => p.trim())

      if (parts.length >= 1) info.name = parts[0]
      if (parts.length >= 2) info.role = parts[1]
      if (parts.length >= 3) info.company = parts.slice(2).join(', ') // In case company has commas

      break
    }
  }

  return info
}

export function getDefaultTakeawaysGuidance() {
  return DEFAULT_TAKEAWAYS_GUIDANCE
}

export function getPromptTemplate() {
  return buildPrompt()
}
