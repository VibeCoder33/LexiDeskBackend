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
    const keyLower = input.s3Key.toLowerCase();
    const labelLower = (input.expectedLabel ?? '').toLowerCase();
    const rawFileName = input.s3Key.split('/').pop()?.toLowerCase() ?? keyLower;

    // Helper to find a category in roleCategories case-insensitively
    const findCategory = (...keywords: string[]): string | undefined => {
      for (const kw of keywords) {
        const found = input.roleCategories.find((c) =>
          c.toLowerCase().includes(kw.toLowerCase())
        );
        if (found) return found;
      }
      return undefined;
    };

    // Helper to test if any token is present in the filename or label
    const containsAny = (target: string, ...tokens: string[]): boolean => {
      return tokens.some((t) => target.includes(t.toLowerCase()));
    };

    // 1. Blurry or Corrupt check
    if (keyLower.includes('blurry') || labelLower.includes('blurry')) {
      return {
        status: 'NEEDS_REVIEW',
        detectedType: 'UNKNOWN_OR_UNCLEAR',
        category: 'Uncategorized',
        reason: 'Image is blurry or illegible. Please request a clearer scan.',
      };
    }

    if (keyLower.includes('corrupt') || keyLower.includes('invalid')) {
      return {
        status: 'NEEDS_REVIEW',
        detectedType: 'UNREADABLE',
        category: 'Uncategorized',
        reason: 'File contents could not be verified automatically.',
      };
    }

    // 2. ID Proofs (Aadhaar, PAN, Passport, Voter ID, Driving License)
    const isPan =
      containsAny(rawFileName, 'pan', 'pancard', 'pan_card') ||
      containsAny(labelLower, 'pan');
    const isAadhaar =
      containsAny(rawFileName, 'aadhaar', 'aadhar', 'uidai') ||
      containsAny(labelLower, 'aadhaar', 'aadhar');
    const isPassportOrVoter = containsAny(
      rawFileName,
      'passport',
      'voter',
      'epic',
      'driving',
      'license',
      'licence',
      'dl_'
    );
    const isGeneralId = containsAny(rawFileName, 'identity', 'id_proof', 'idproof');

    if (isPan) {
      const idCat = findCategory('id', 'tax') ?? 'ID Proofs';
      return {
        status: 'VERIFIED',
        detectedType: 'PAN_CARD',
        category: idCat,
        reason: 'PAN Card verified successfully.',
      };
    }

    if (isAadhaar) {
      const idCat = findCategory('id') ?? 'ID Proofs';
      return {
        status: 'VERIFIED',
        detectedType: 'AADHAAR_CARD',
        category: idCat,
        reason: 'Aadhaar Card verified successfully.',
      };
    }

    if (isPassportOrVoter || isGeneralId) {
      const idCat = findCategory('id') ?? 'ID Proofs';
      return {
        status: 'VERIFIED',
        detectedType: isPassportOrVoter ? 'IDENTITY_DOCUMENT' : 'ID_PROOF',
        category: idCat,
        reason: 'Identity document verified successfully.',
      };
    }

    // 3. Property Deeds & Land Records
    const isSaleDeed = containsAny(
      rawFileName,
      'sale_deed',
      'saledeed',
      'conveyance',
      'gift_deed',
      'development_agreement',
      'deed'
    );
    const isLandRecord = containsAny(
      rawFileName,
      '7/12',
      '7-12',
      '7_12',
      'satbara',
      'index_ii',
      'index2',
      'indexii',
      'mutation',
      'property_card',
      'khata'
    );
    const isTitleSearch = containsAny(
      rawFileName,
      'title_search',
      'search_report',
      'title_verification'
    );
    const isLease = containsAny(
      rawFileName,
      'lease',
      'rent_agreement',
      'leave_and_license',
      'leave_license'
    );

    if (isSaleDeed || isLandRecord || isTitleSearch || isLease) {
      const propCat = findCategory('deed', 'property') ?? 'Property Deeds';
      let docType = 'PROPERTY_DEED';
      if (isLandRecord) docType = '7_12_LAND_RECORD';
      else if (isTitleSearch) docType = 'TITLE_SEARCH_REPORT';
      else if (isLease) docType = 'LEASE_AGREEMENT';
      else if (isSaleDeed) docType = 'SALE_DEED';

      return {
        status: 'VERIFIED',
        detectedType: docType,
        category: propCat,
        reason: 'Property record verified and categorized into Property Deeds.',
      };
    }

    // 4. Tax Receipts & Returns
    const isForm16 = containsAny(rawFileName, 'form_16', 'form16', 'form-16');
    const isItr = containsAny(
      rawFileName,
      'itr',
      'itr-v',
      'itrv',
      'tax_return',
      'computation'
    );
    const isAisOr26as = containsAny(
      rawFileName,
      'ais',
      '26as',
      'annual_information'
    );
    const isTaxReceipt = containsAny(
      rawFileName,
      'tax_receipt',
      'challan',
      'advance_tax',
      'property_tax',
      'municipal_tax'
    );

    if (isForm16 || isItr || isAisOr26as || isTaxReceipt) {
      const taxCat = findCategory('tax') ?? 'Tax Receipts';
      let docType = 'TAX_DOCUMENT';
      if (isForm16) docType = 'FORM_16';
      else if (isItr) docType = 'ITR_ACKNOWLEDGEMENT';
      else if (isAisOr26as) docType = 'ANNUAL_TAX_STATEMENT';
      else if (isTaxReceipt) docType = 'TAX_RECEIPT';

      return {
        status: 'VERIFIED',
        detectedType: docType,
        category: taxCat,
        reason: 'Tax document verified successfully.',
      };
    }

    // 5. Court Orders & Pleadings & Evidence
    const isCourtOrder = containsAny(
      rawFileName,
      'court_order',
      'judgment',
      'judgement',
      'decree',
      'stay_order',
      'interim_order',
      'certified_copy'
    );
    const isPleading = containsAny(
      rawFileName,
      'plaint',
      'petition',
      'written_statement',
      'affidavit',
      'vakalatnama',
      'reply',
      'rejoinder',
      'legal_notice',
      'notice_487',
      'section_138',
      'defense'
    );
    const isEvidence = containsAny(rawFileName, 'evidence', 'exhibit', 'proof');

    if (isCourtOrder) {
      const orderCat =
        findCategory('order', 'pleading', 'court') ?? 'Court Orders';
      return {
        status: 'VERIFIED',
        detectedType: 'COURT_ORDER',
        category: orderCat,
        reason: 'Court order verified successfully.',
      };
    }

    if (isPleading) {
      const pleadingCat =
        findCategory('pleading', 'court') ?? 'Pleadings';
      return {
        status: 'VERIFIED',
        detectedType: 'LEGAL_PLEADING',
        category: pleadingCat,
        reason: 'Legal pleading verified successfully.',
      };
    }

    if (isEvidence) {
      const evidenceCat =
        findCategory('evidence', 'pleading') ?? 'Evidence';
      return {
        status: 'VERIFIED',
        detectedType: 'EXHIBIT_EVIDENCE',
        category: evidenceCat,
        reason: 'Evidence document verified successfully.',
      };
    }

    // 6. GST Documents
    const isGst = containsAny(
      rawFileName,
      'gstr',
      'gstin',
      'gst_cert',
      'cash_ledger',
      'gst'
    );
    if (isGst) {
      const gstCat = findCategory('gst') ?? 'GST Documents';
      return {
        status: 'VERIFIED',
        detectedType: 'GST_DOCUMENT',
        category: gstCat,
        reason: 'GST document verified successfully.',
      };
    }

    // 7. Society Documents
    const isSociety = containsAny(
      rawFileName,
      'society',
      'share_certificate',
      'bye_laws',
      'maintenance_receipt'
    );
    if (isSociety) {
      const socCat = findCategory('society') ?? 'Society Documents';
      return {
        status: 'VERIFIED',
        detectedType: 'SOCIETY_DOCUMENT',
        category: socCat,
        reason: 'Society document verified successfully.',
      };
    }

    // 8. Bank Statements
    const isBank = containsAny(
      rawFileName,
      'bank_statement',
      'bank_stmt',
      'passbook',
      'cheque'
    );
    if (isBank) {
      const bankCat = findCategory('bank') ?? 'Bank Statements';
      return {
        status: 'VERIFIED',
        detectedType: 'BANK_STATEMENT',
        category: bankCat,
        reason: 'Bank statement verified successfully.',
      };
    }

    // 9. Requirement Keyword Correlation
    // If expectedLabel was given, verify if rawFileName has genuine overlap
    if (labelLower) {
      const labelTokens = labelLower
        .split(/[\s-_/]+/)
        .filter((t) => t.length > 3);
      const filenameMatchesLabel = labelTokens.some((tok) =>
        rawFileName.includes(tok)
      );

      const matchingCategory = input.roleCategories.find(
        (c) =>
          labelLower.includes(c.toLowerCase()) ||
          c.toLowerCase().includes(labelLower)
      );

      if (matchingCategory && filenameMatchesLabel) {
        return {
          status: 'VERIFIED',
          detectedType: 'REQUIREMENT_MATCH',
          category: matchingCategory,
          reason: `Document verified for requirement: ${input.expectedLabel}`,
        };
      }
    }

    // 10. Unrecognized / Miscellaneous Documents (e.g. "ai concept document.pdf")
    // Strictly assign to "Uncategorized", do NOT force into ID Proofs or any category
    return {
      status: 'NEEDS_REVIEW',
      detectedType: 'UNRECOGNIZED_DOCUMENT',
      category: 'Uncategorized',
      reason:
        'Document could not be automatically matched to predefined categories. Placed in Uncategorized documents for lawyer review.',
    };
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
              content: `Analyze this Indian legal/tax document with expected label "${input.expectedLabel ?? 'None'}". Available predefined categories: ${input.roleCategories.join(', ')}. If the document does not clearly belong to one of these categories or is an unrelated file (e.g. concept notes, AI concepts, general guides), set "category" strictly to "Uncategorized" and "status" to "NEEDS_REVIEW". Return strict JSON with { "status": "VERIFIED"|"NEEDS_REVIEW", "detectedType": string, "category": string, "reason": string }`,
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
      logger.error({ err }, 'Anthropic vision verification failed, falling back to Uncategorized NEEDS_REVIEW')
      return {
        status: 'NEEDS_REVIEW',
        detectedType: 'UNRECOGNIZED_DOCUMENT',
        category: 'Uncategorized',
        reason: 'Automated verification error; placed in Uncategorized for manual review.',
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
