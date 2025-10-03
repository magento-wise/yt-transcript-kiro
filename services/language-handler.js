// services/language-handler.js
// Language detection and multi-language support service

/**
 * Common language codes and their variants
 */
export const LANGUAGE_MAPPINGS = {
  // English variants
  'en': ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU'],
  'en-US': ['en-US', 'en'],
  'en-GB': ['en-GB', 'en'],
  
  // Spanish variants
  'es': ['es', 'es-ES', 'es-MX', 'es-AR'],
  'es-ES': ['es-ES', 'es'],
  'es-MX': ['es-MX', 'es'],
  
  // French variants
  'fr': ['fr', 'fr-FR', 'fr-CA'],
  'fr-FR': ['fr-FR', 'fr'],
  'fr-CA': ['fr-CA', 'fr'],
  
  // German variants
  'de': ['de', 'de-DE', 'de-AT', 'de-CH'],
  'de-DE': ['de-DE', 'de'],
  
  // Portuguese variants
  'pt': ['pt', 'pt-BR', 'pt-PT'],
  'pt-BR': ['pt-BR', 'pt'],
  'pt-PT': ['pt-PT', 'pt'],
  
  // Italian
  'it': ['it', 'it-IT'],
  
  // Japanese
  'ja': ['ja', 'ja-JP'],
  
  // Korean
  'ko': ['ko', 'ko-KR'],
  
  // Chinese variants
  'zh': ['zh', 'zh-CN', 'zh-TW', 'zh-HK'],
  'zh-CN': ['zh-CN', 'zh'],
  'zh-TW': ['zh-TW', 'zh'],
  
  // Russian
  'ru': ['ru', 'ru-RU'],
  
  // Arabic
  'ar': ['ar', 'ar-SA', 'ar-EG'],
  
  // Hindi
  'hi': ['hi', 'hi-IN'],
  
  // Dutch
  'nl': ['nl', 'nl-NL'],
  
  // Swedish
  'sv': ['sv', 'sv-SE'],
  
  // Norwegian
  'no': ['no', 'nb', 'nn'],
  
  // Danish
  'da': ['da', 'da-DK'],
  
  // Finnish
  'fi': ['fi', 'fi-FI'],
  
  // Polish
  'pl': ['pl', 'pl-PL'],
  
  // Turkish
  'tr': ['tr', 'tr-TR'],
  
  // Hebrew
  'he': ['he', 'iw'],
  
  // Thai
  'th': ['th', 'th-TH'],
  
  // Vietnamese
  'vi': ['vi', 'vi-VN'],
  
  // Indonesian
  'id': ['id', 'id-ID'],
  
  // Malay
  'ms': ['ms', 'ms-MY']
};

/**
 * Language priority for fallbacks (most common languages first)
 */
export const LANGUAGE_PRIORITY = [
  'en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh', 'ru', 'ar', 'hi'
];

/**
 * LanguageHandler class for managing multi-language support
 */
export class LanguageHandler {
  constructor() {
    this.supportedLanguages = new Set(Object.keys(LANGUAGE_MAPPINGS));
  }

  /**
   * Normalize language code to standard format
   * @param {string} languageCode - Input language code
   * @returns {string} - Normalized language code
   */
  normalizeLanguageCode(languageCode) {
    if (!languageCode || typeof languageCode !== 'string') {
      return 'en';
    }

    const normalized = languageCode.toLowerCase().trim();
    
    // Direct match
    if (this.supportedLanguages.has(normalized)) {
      return normalized;
    }

    // Check for base language (e.g., 'en' from 'en-US')
    const baseLang = normalized.split('-')[0];
    if (this.supportedLanguages.has(baseLang)) {
      return baseLang;
    }

    // Check for common variants
    for (const [key, variants] of Object.entries(LANGUAGE_MAPPINGS)) {
      if (variants.includes(normalized)) {
        return key;
      }
    }

    // Default to English if not found
    return 'en';
  }

  /**
   * Find the best matching language from available options
   * @param {string[]} availableLanguages - Languages available in the video
   * @param {string} preferredLanguage - User's preferred language
   * @returns {Object} - Best match result
   */
  findBestLanguageMatch(availableLanguages, preferredLanguage = 'en') {
    if (!availableLanguages || availableLanguages.length === 0) {
      return {
        selectedLanguage: preferredLanguage,
        matchType: 'none',
        confidence: 0,
        availableAlternatives: []
      };
    }

    const normalizedPreferred = this.normalizeLanguageCode(preferredLanguage);
    const normalizedAvailable = availableLanguages.map(lang => 
      this.normalizeLanguageCode(lang)
    );

    console.log(`🌍 Finding best match for '${preferredLanguage}' from: ${availableLanguages.join(', ')}`);

    // 1. Exact match
    const exactMatch = availableLanguages.find(lang => 
      this.normalizeLanguageCode(lang) === normalizedPreferred
    );
    if (exactMatch) {
      console.log(`✅ Exact match found: ${exactMatch}`);
      return {
        selectedLanguage: exactMatch,
        matchType: 'exact',
        confidence: 1.0,
        availableAlternatives: availableLanguages.filter(lang => lang !== exactMatch)
      };
    }

    // 2. Language family match (e.g., 'en-US' matches 'en')
    const familyMatch = availableLanguages.find(lang => {
      const normalized = this.normalizeLanguageCode(lang);
      const baseLang = normalizedPreferred.split('-')[0];
      return normalized.startsWith(baseLang) || normalized === baseLang;
    });
    if (familyMatch) {
      console.log(`✅ Language family match found: ${familyMatch}`);
      return {
        selectedLanguage: familyMatch,
        matchType: 'family',
        confidence: 0.8,
        availableAlternatives: availableLanguages.filter(lang => lang !== familyMatch)
      };
    }

    // 3. Priority language fallback
    for (const priorityLang of LANGUAGE_PRIORITY) {
      const priorityMatch = availableLanguages.find(lang => 
        this.normalizeLanguageCode(lang) === priorityLang
      );
      if (priorityMatch) {
        console.log(`✅ Priority fallback match found: ${priorityMatch}`);
        return {
          selectedLanguage: priorityMatch,
          matchType: 'priority_fallback',
          confidence: 0.6,
          availableAlternatives: availableLanguages.filter(lang => lang !== priorityMatch)
        };
      }
    }

    // 4. First available language
    const firstAvailable = availableLanguages[0];
    console.log(`⚠️ Using first available language: ${firstAvailable}`);
    return {
      selectedLanguage: firstAvailable,
      matchType: 'first_available',
      confidence: 0.3,
      availableAlternatives: availableLanguages.slice(1)
    };
  }

  /**
   * Get language variants for fallback attempts
   * @param {string} languageCode - Base language code
   * @returns {string[]} - Array of language variants to try
   */
  getLanguageVariants(languageCode) {
    const normalized = this.normalizeLanguageCode(languageCode);
    const variants = LANGUAGE_MAPPINGS[normalized] || [normalized];
    
    // Add common variants
    const baseLang = normalized.split('-')[0];
    if (baseLang !== normalized && LANGUAGE_MAPPINGS[baseLang]) {
      variants.push(...LANGUAGE_MAPPINGS[baseLang]);
    }

    // Remove duplicates and return
    return [...new Set(variants)];
  }

  /**
   * Detect language from transcript text (basic implementation)
   * @param {string} text - Transcript text sample
   * @returns {Object} - Language detection result
   */
  detectLanguageFromText(text) {
    if (!text || text.length < 50) {
      return {
        detectedLanguage: 'en',
        confidence: 0.1,
        method: 'default'
      };
    }

    // Simple heuristic-based detection
    const lowerText = text.toLowerCase();
    
    // English indicators
    if (this._hasEnglishIndicators(lowerText)) {
      return {
        detectedLanguage: 'en',
        confidence: 0.7,
        method: 'heuristic'
      };
    }

    // Spanish indicators
    if (this._hasSpanishIndicators(lowerText)) {
      return {
        detectedLanguage: 'es',
        confidence: 0.7,
        method: 'heuristic'
      };
    }

    // French indicators
    if (this._hasFrenchIndicators(lowerText)) {
      return {
        detectedLanguage: 'fr',
        confidence: 0.7,
        method: 'heuristic'
      };
    }

    // German indicators
    if (this._hasGermanIndicators(lowerText)) {
      return {
        detectedLanguage: 'de',
        confidence: 0.7,
        method: 'heuristic'
      };
    }

    // Default to English with low confidence
    return {
      detectedLanguage: 'en',
      confidence: 0.3,
      method: 'fallback'
    };
  }

  /**
   * Create language-aware extraction configuration
   * @param {string} preferredLanguage - User's preferred language
   * @param {string[]} availableLanguages - Available languages in video
   * @param {string} extractionMethod - Extraction method being used
   * @returns {Object} - Language configuration
   */
  createLanguageConfig(preferredLanguage, availableLanguages, extractionMethod) {
    const matchResult = this.findBestLanguageMatch(availableLanguages, preferredLanguage);
    const variants = this.getLanguageVariants(preferredLanguage);

    const config = {
      primaryLanguage: matchResult.selectedLanguage,
      fallbackLanguages: variants,
      availableLanguages: availableLanguages,
      matchConfidence: matchResult.confidence,
      matchType: matchResult.matchType
    };

    // Method-specific adjustments
    switch (extractionMethod) {
      case 'youtube-transcript':
        config.country = this._getCountryForLanguage(matchResult.selectedLanguage);
        config.retryLanguages = variants.slice(0, 3); // Limit retries
        break;

      case 'youtube-caption-extractor':
        config.langCode = matchResult.selectedLanguage;
        break;

      case 'whisper-audio':
        // Whisper auto-detects, but we can provide a hint
        config.languageHint = this.normalizeLanguageCode(preferredLanguage);
        break;
    }

    return config;
  }

  /**
   * Check for English language indicators
   * @param {string} text - Text to check
   * @returns {boolean}
   * @private
   */
  _hasEnglishIndicators(text) {
    const englishWords = ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but'];
    const matches = englishWords.filter(word => text.includes(` ${word} `)).length;
    return matches >= 3;
  }

  /**
   * Check for Spanish language indicators
   * @param {string} text - Text to check
   * @returns {boolean}
   * @private
   */
  _hasSpanishIndicators(text) {
    const spanishWords = ['que', 'de', 'no', 'la', 'el', 'en', 'es', 'se', 'te', 'lo'];
    const matches = spanishWords.filter(word => text.includes(` ${word} `)).length;
    return matches >= 3;
  }

  /**
   * Check for French language indicators
   * @param {string} text - Text to check
   * @returns {boolean}
   * @private
   */
  _hasFrenchIndicators(text) {
    const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir'];
    const matches = frenchWords.filter(word => text.includes(` ${word} `)).length;
    return matches >= 3;
  }

  /**
   * Check for German language indicators
   * @param {string} text - Text to check
   * @returns {boolean}
   * @private
   */
  _hasGermanIndicators(text) {
    const germanWords = ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'];
    const matches = germanWords.filter(word => text.includes(` ${word} `)).length;
    return matches >= 3;
  }

  /**
   * Get appropriate country code for language
   * @param {string} languageCode - Language code
   * @returns {string} - Country code
   * @private
   */
  _getCountryForLanguage(languageCode) {
    const countryMappings = {
      'en': 'US',
      'en-US': 'US',
      'en-GB': 'GB',
      'en-CA': 'CA',
      'en-AU': 'AU',
      'es': 'ES',
      'es-MX': 'MX',
      'es-AR': 'AR',
      'fr': 'FR',
      'fr-CA': 'CA',
      'de': 'DE',
      'pt': 'BR',
      'pt-BR': 'BR',
      'pt-PT': 'PT',
      'it': 'IT',
      'ja': 'JP',
      'ko': 'KR',
      'zh': 'CN',
      'zh-CN': 'CN',
      'zh-TW': 'TW',
      'ru': 'RU'
    };

    return countryMappings[languageCode] || 'US';
  }
}

// Export singleton instance
export const languageHandler = new LanguageHandler();