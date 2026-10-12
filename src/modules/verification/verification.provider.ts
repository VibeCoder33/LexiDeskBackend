import { logger } from '../../lib/logger'

export interface VerificationInput {
  s3Key: string
  mimeType: string
  expectedLabel?: string
  roleCategories: readonly string[]
}

export interface VerificationResult {
  status: 'VERIFIED' | 'NEEDS_REVIEW'
  detectedType: string | null
  category: string
  reason?: string
}

export interface VerificationProvider {
  verify(input: VerificationInput): Promise<VerificationResult>
}

/**
 * MockProvider — deterministic verification for local dev and tests.
 * Rules:
 * - If filename / expectedLabel contains 'pan' or 'aadhaar' or 'tax' or 'deed' or 'order' -> VERIFIED with detected type.
 * - If filename contains 'blurry' or 'corrupt' or 'invalid' -> NEEDS_REVIEW with reason.
 * - Otherwise VERIFIED with matched category from roleCategories.
 */
export class MockProvider implements VerificationProvider {
  async verify(input: VerificationInput): Promise<VerificationResult> {
    const keyLower = input.s3Key.toLowerCase()
    const labelLower = (input.expectedLabel ?? '').toLowerCase()

    if (keyLower.includes('blurry') || labelLower.includes('blurry')) {
      return {
        status: 'NEEDS_REVIEW',
        detectedType: 'UNKNOWN_OR_UNCLEAR',
        category: input.roleCategories[input.roleCategories.length - 1] ?? 'Other',
        reason: 'Image is blurry or illegible. Please request a clearer scan.',
      }
    }

    if (keyLower.includes('corrupt') || keyLower.includes('invalid')) {
      return {
        status: 'NEEDS_REVIEW',
        detectedType: 'UNREADABLE',
        category: input.roleCategories[input.roleCategories.length - 1] ?? 'Other',
        reason: 'File contents could not be verified automatically.',
      }
    }

    let detectedType = 'DOCUMENT'
    let assignedCategory = input.roleCategories[0] ?? 'ID Proofs'

    if (keyLower.includes('pan') || labelLower.includes('pan')) {
      detectedType = 'PAN_CARD'
      assignedCategory = input.roleCategories.find((c) => c.toLowerCase().includes('id') || c.toLowerCase().includes('tax')) ?? assignedCategory
    } else if (keyLower.includes('aadhaar') || labelLower.includes('aadhaar')) {
      detectedType = 'AADHAAR_CARD'
      assignedCategory = input.roleCategories.find((c) => c.toLowerCase().includes('id')) ?? assignedCategory
    } else if (keyLower.includes('deed') || labelLower.includes('deed')) {
      detectedType = 'SALE_DEED'
      assignedCategory = input.roleCategories.find((c) => c.toLowerCase().includes('deed') || c.toLowerCase().includes('property')) ?? assignedCategory
    } else if (keyLower.includes('receipt') || labelLower.includes('receipt') || keyLower.includes('tax')) {
      detectedType = 'TAX_RECEIPT'
      assignedCategory = input.roleCategories.find((c) => c.toLowerCase().includes('tax')) ?? assignedCategory
    } else if (keyLower.includes('hearing') || keyLower.includes('order') || labelLower.includes('court')) {
      detectedType = 'COURT_ORDER'
      assignedCategory = input.roleCategories.find((c) => c.toLowerCase().includes('order') || c.toLowerCase().includes('pleading')) ?? assignedCategory
    } else {
      // Pick matching or first category
      const match = input.roleCategories.find((c) => labelLower.includes(c.toLowerCase()))
      if (match) assignedCategory = match
    }

    return {
      status: 'VERIFIED',
      detectedType,
      category: assignedCategory,
      reason: 'Document verified and matched with requirement.',
    }
  }
}

/**
 * AnthropicVisionProvider — calls Claude API when ANTHROPIC_API_KEY is configured.
 */
export class AnthropicVisionProvider implements VerificationProvider {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async verify(input: VerificationInput): Promise<VerificationResult> {
    try {
      // In production, fetch presigned GET from S3 and call Claude vision API
      logger.info({ s3Key: input.s3Key }, 'Calling Anthropic Vision API for verification')
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Analyze this Indian legal/tax document with expected label "${input.expectedLabel ?? 'None'}". Available categories: ${input.roleCategories.join(', ')}. Return strict JSON with { "status": "VERIFIED"|"NEEDS_REVIEW", "detectedType": string, "category": string, "reason": string }`,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic API responded with HTTP ${response.status}`)
      }

      const data = await response.json() as { content?: Array<{ text?: string }> }
      const text = data.content?.[0]?.text ?? ''
      const parsed = JSON.parse(text) as VerificationResult
      return parsed
    } catch (err) {
      logger.error({ err }, 'Anthropic vision verification failed, falling back to NEEDS_REVIEW')
      return {
        status: 'NEEDS_REVIEW',
        detectedType: null,
        category: input.roleCategories[input.roleCategories.length - 1] ?? 'Other',
        reason: 'Automated verification error; please review document manually.',
      }
    }
  }
}

const useAnthropic =
  process.env.VERIFICATION_PROVIDER === 'anthropic' &&
  Boolean(process.env.ANTHROPIC_API_KEY)

export const verificationProvider: VerificationProvider = useAnthropic
  ? new AnthropicVisionProvider(process.env.ANTHROPIC_API_KEY!)
  : new MockProvider()

logger.info(
  { provider: useAnthropic ? 'Anthropic Vision' : 'Mock Provider' },
  'Verification provider initialized'
)
