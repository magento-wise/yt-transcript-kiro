// services/strategy-selector.js
// Transcript extraction strategy selector

import { DEFAULT_PREFERENCES } from '../types/interfaces.js';
import { languageHandler } from './language-handler.js';

/**
 * Transcript extraction methods in order of preference
 */
export const TRANSCRIPT_METHODS = {
  YOUTUBE_TRANSCRIPT: 'youtube-transcript',
  YOUTUBE_CAPTION_EXTRACTOR: 'youtube-caption-extractor', 
  WHISPER_AUDIO: 'whisper-audio'
};

/**
 * TranscriptStrategySelector class for choosing optimal extraction method
 */
export class TranscriptStrategySelector {
  constructor() {
    // Method priority order (fastest to slowest)
    this.methodPriority = [
      TRANSCRIPT_METHODS.YOUTUBE_TRANSCRIPT,
      TRANSCRIPT_METHODS.YOUTUBE_CAPTION_EXTRACTOR,
      TRANSCRIPT_METHODS.WHISPER_AUDIO
    ];
  }

  /**
   * Select the best transcript extraction strategy based on video metadata and preferences
   * @param {VideoMetadata} metadata - Video metadata
   * @param {ExtractionPreferences} preferences - User preferences
   * @returns {TranscriptMethod[]} - Ordered list of methods to try
   */
  selectStrategy(metadata, preferences = {}) {
    // Merge with default preferences
    const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
    
    console.log(`🎯 Selecting strategy for video: ${metadata.videoId}`);
    console.log(`📋 Video has captions: ${metadata.hasClosedCaptions}`);
    console.log(`🌍 Available languages: ${metadata.availableLanguages.join(', ')}`);
    console.log(`⚙️ User preferences:`, prefs);

    const strategies = [];

    // Check if video is suitable for transcript extraction
    if (!this._isVideoSuitableForExtraction(metadata)) {
      console.log('⚠️ Video not suitable for extraction, using audio-only method');
      return prefs.fallbackToAudio ? [TRANSCRIPT_METHODS.WHISPER_AUDIO] : [];
    }

    // If video has captions, prioritize caption-based methods
    if (metadata.hasClosedCaptions) {
      console.log('✅ Video has captions, prioritizing caption methods');
      
      // Check if preferred language is available
      const hasPreferredLanguage = this._hasPreferredLanguage(
        metadata.availableLanguages, 
        prefs.preferredLanguage
      );

      if (hasPreferredLanguage) {
        console.log(`🎯 Preferred language '${prefs.preferredLanguage}' is available`);
        // Add caption methods in priority order
        strategies.push(TRANSCRIPT_METHODS.YOUTUBE_TRANSCRIPT);
        strategies.push(TRANSCRIPT_METHODS.YOUTUBE_CAPTION_EXTRACTOR);
      } else {
        console.log(`⚠️ Preferred language '${prefs.preferredLanguage}' not available`);
        console.log(`📋 Will try caption methods with available languages`);
        // Still try caption methods, they might auto-select best available language
        strategies.push(TRANSCRIPT_METHODS.YOUTUBE_TRANSCRIPT);
        strategies.push(TRANSCRIPT_METHODS.YOUTUBE_CAPTION_EXTRACTOR);
      }
    } else {
      console.log('⚠️ No captions detected, will rely on audio transcription');
    }

    // Add audio transcription as fallback if enabled
    if (prefs.fallbackToAudio) {
      console.log('🔄 Adding audio transcription as fallback method');
      strategies.push(TRANSCRIPT_METHODS.WHISPER_AUDIO);
    }

    // Remove duplicates while preserving order
    const uniqueStrategies = [...new Set(strategies)];
    
    console.log(`📋 Final strategy order: ${uniqueStrategies.join(' → ')}`);
    
    return uniqueStrategies;
  }

  /**
   * Get the primary (first choice) strategy
   * @param {VideoMetadata} metadata - Video metadata
   * @param {ExtractionPreferences} preferences - User preferences
   * @returns {TranscriptMethod|null} - Primary method or null if none suitable
   */
  getPrimaryStrategy(metadata, preferences = {}) {
    const strategies = this.selectStrategy(metadata, preferences);
    return strategies.length > 0 ? strategies[0] : null;
  }

  /**
   * Check if a specific method is recommended for the video
   * @param {VideoMetadata} metadata - Video metadata
   * @param {TranscriptMethod} method - Method to check
   * @param {ExtractionPreferences} preferences - User preferences
   * @returns {boolean} - True if method is recommended
   */
  isMethodRecommended(metadata, method, preferences = {}) {
    const strategies = this.selectStrategy(metadata, preferences);
    return strategies.includes(method);
  }

  /**
   * Get method-specific configuration based on video metadata
   * @param {TranscriptMethod} method - Extraction method
   * @param {VideoMetadata} metadata - Video metadata
   * @param {ExtractionPreferences} preferences - User preferences
   * @returns {Object} - Method configuration
   */
  getMethodConfig(method, metadata, preferences = {}) {
    const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
    
    // Create language-aware configuration
    const languageConfig = languageHandler.createLanguageConfig(
      prefs.preferredLanguage,
      metadata.availableLanguages,
      method
    );
    
    const baseConfig = {
      videoId: metadata.videoId,
      language: languageConfig.primaryLanguage,
      format: prefs.format,
      languageConfig: languageConfig
    };

    switch (method) {
      case TRANSCRIPT_METHODS.YOUTUBE_TRANSCRIPT:
        return {
          ...baseConfig,
          country: languageConfig.country || 'US',
          fallbackLanguages: languageConfig.fallbackLanguages || this._getFallbackLanguages(metadata.availableLanguages, prefs.preferredLanguage)
        };

      case TRANSCRIPT_METHODS.YOUTUBE_CAPTION_EXTRACTOR:
        return {
          ...baseConfig,
          availableLanguages: metadata.availableLanguages,
          langCode: languageConfig.langCode || languageConfig.primaryLanguage
        };

      case TRANSCRIPT_METHODS.WHISPER_AUDIO:
        return {
          ...baseConfig,
          title: metadata.title,
          description: metadata.description,
          duration: metadata.duration,
          // Whisper-specific settings
          model: 'whisper-1',
          response_format: prefs.format === 'srt' ? 'srt' : 'verbose_json',
          timestamp_granularities: prefs.format === 'json' ? ['word'] : undefined,
          languageHint: languageConfig.languageHint
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Estimate extraction time for different methods
   * @param {TranscriptMethod} method - Extraction method
   * @param {VideoMetadata} metadata - Video metadata
   * @returns {number} - Estimated time in seconds
   */
  estimateExtractionTime(method, metadata) {
    const duration = metadata.duration || 300; // Default 5 minutes if unknown

    switch (method) {
      case TRANSCRIPT_METHODS.YOUTUBE_TRANSCRIPT:
        return Math.min(10, duration * 0.02); // ~2% of video duration, max 10s

      case TRANSCRIPT_METHODS.YOUTUBE_CAPTION_EXTRACTOR:
        return Math.min(15, duration * 0.03); // ~3% of video duration, max 15s

      case TRANSCRIPT_METHODS.WHISPER_AUDIO:
        // Audio transcription takes longer: download + processing
        return Math.min(300, 30 + (duration * 0.1)); // 30s base + 10% of duration, max 5min

      default:
        return 60; // Default 1 minute
    }
  }

  /**
   * Check if video is suitable for transcript extraction
   * @param {VideoMetadata} metadata - Video metadata
   * @returns {boolean} - True if suitable
   * @private
   */
  _isVideoSuitableForExtraction(metadata) {
    // Skip live videos (they might not have stable captions)
    if (metadata.isLive) {
      console.log('⚠️ Skipping live video');
      return false;
    }

    // Skip upcoming/scheduled videos
    if (metadata.isUpcoming) {
      console.log('⚠️ Skipping upcoming video');
      return false;
    }

    // Skip very short videos (likely not worth transcribing)
    if (metadata.duration > 0 && metadata.duration < 10) {
      console.log('⚠️ Skipping very short video (< 10 seconds)');
      return false;
    }

    // Skip very long videos for audio transcription (cost/time concerns)
    if (metadata.duration > 7200) { // 2 hours
      console.log('⚠️ Very long video detected (> 2 hours)');
      // Still suitable, but will affect strategy selection
    }

    return true;
  }

  /**
   * Check if preferred language is available in the video
   * @param {string[]} availableLanguages - Available caption languages
   * @param {string} preferredLanguage - Preferred language code
   * @returns {boolean} - True if preferred language is available
   * @private
   */
  _hasPreferredLanguage(availableLanguages, preferredLanguage) {
    if (!availableLanguages || availableLanguages.length === 0) {
      return false;
    }

    // Direct match
    if (availableLanguages.includes(preferredLanguage)) {
      return true;
    }

    // Check for language variants (e.g., 'en-US' matches 'en')
    const langPrefix = preferredLanguage.split('-')[0];
    return availableLanguages.some(lang => lang.startsWith(langPrefix));
  }

  /**
   * Get fallback languages in order of preference
   * @param {string[]} availableLanguages - Available caption languages
   * @param {string} preferredLanguage - Preferred language code
   * @returns {string[]} - Ordered list of fallback languages
   * @private
   */
  _getFallbackLanguages(availableLanguages, preferredLanguage) {
    if (!availableLanguages || availableLanguages.length === 0) {
      return [preferredLanguage];
    }

    const fallbacks = [];
    const langPrefix = preferredLanguage.split('-')[0];

    // Add exact match first
    if (availableLanguages.includes(preferredLanguage)) {
      fallbacks.push(preferredLanguage);
    }

    // Add language variants
    availableLanguages.forEach(lang => {
      if (lang.startsWith(langPrefix) && !fallbacks.includes(lang)) {
        fallbacks.push(lang);
      }
    });

    // Add English as universal fallback if not already included
    if (!fallbacks.some(lang => lang.startsWith('en'))) {
      const englishLangs = availableLanguages.filter(lang => lang.startsWith('en'));
      fallbacks.push(...englishLangs);
    }

    // Add any remaining languages
    availableLanguages.forEach(lang => {
      if (!fallbacks.includes(lang)) {
        fallbacks.push(lang);
      }
    });

    return fallbacks.length > 0 ? fallbacks : [preferredLanguage];
  }
}

// Export singleton instance
export const strategySelector = new TranscriptStrategySelector();