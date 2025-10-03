// types/interfaces.js
// TypeScript-style interfaces defined as JSDoc for JavaScript

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the URL/video ID is valid
 * @property {string|null} videoId - Extracted video ID
 * @property {string|null} normalizedUrl - Normalized YouTube URL
 * @property {string|null} error - Error message if validation failed
 */

/**
 * @typedef {Object} VideoMetadata
 * @property {string} videoId - YouTube video ID
 * @property {string} title - Video title
 * @property {string} description - Video description
 * @property {number} duration - Video duration in seconds
 * @property {boolean} isLive - Whether video is currently live
 * @property {boolean} isUpcoming - Whether video is scheduled for future
 * @property {boolean} hasClosedCaptions - Whether video has captions available
 * @property {string[]} availableLanguages - List of available caption languages
 * @property {string} thumbnailUrl - Video thumbnail URL
 * @property {string} channelName - Channel name
 * @property {string} publishDate - Video publish date
 */

/**
 * @typedef {Object} AvailabilityStatus
 * @property {boolean} isAvailable - Whether video is accessible
 * @property {boolean} isPrivate - Whether video is private
 * @property {boolean} isRestricted - Whether video has restrictions
 * @property {string|null} error - Error message if unavailable
 */

/**
 * @typedef {Object} ExtractionPreferences
 * @property {string} [preferredLanguage] - Preferred caption language (default: 'en')
 * @property {'txt'|'srt'|'json'} format - Output format (default: 'txt')
 * @property {boolean} fallbackToAudio - Whether to fallback to audio transcription (default: true)
 */

/**
 * @typedef {Object} TranscriptResult
 * @property {boolean} success - Whether extraction was successful
 * @property {string} transcript - Extracted transcript text
 * @property {string} format - Output format used
 * @property {string} language - Detected or specified language
 * @property {TranscriptMethod} method - Extraction method used
 * @property {TranscriptSegment[]} [segments] - Transcript segments with timestamps
 * @property {number} [confidence] - Confidence score (0-1)
 * @property {number} [audioSizeBytes] - Audio file size if audio method used
 * @property {string|null} error - Error message if extraction failed
 */

/**
 * @typedef {Object} TranscriptSegment
 * @property {string} text - Segment text
 * @property {number} start - Start time in milliseconds
 * @property {number} duration - Duration in milliseconds
 * @property {number} [confidence] - Confidence score for this segment
 */

/**
 * @typedef {'youtube-transcript'|'youtube-caption-extractor'|'whisper-audio'} TranscriptMethod
 */

/**
 * @typedef {Object} TranscriptRequest
 * @property {string} [url] - YouTube URL
 * @property {string} [videoId] - YouTube video ID
 * @property {'txt'|'srt'|'json'} [format] - Output format
 * @property {string} [language] - Preferred language
 * @property {boolean} [fallbackToAudio] - Whether to fallback to audio transcription
 */

/**
 * @typedef {Object} TranscriptResponse
 * @property {boolean} success - Whether request was successful
 * @property {TranscriptData} [data] - Response data if successful
 * @property {string} [error] - Error message if failed
 * @property {string} [code] - Error code if failed
 * @property {string} message - Human-readable message
 */

/**
 * @typedef {Object} TranscriptData
 * @property {string} transcript - Extracted transcript
 * @property {string} videoId - YouTube video ID
 * @property {string} videoTitle - Video title
 * @property {string} format - Output format
 * @property {string} language - Language used
 * @property {TranscriptMethod} method - Extraction method used
 * @property {number} segments - Number of transcript segments
 * @property {number} [duration] - Video duration in seconds
 * @property {number} [confidence] - Overall confidence score
 * @property {number} extractionTime - Time taken for extraction in ms
 */

/**
 * @typedef {Object} ProcessingContext
 * @property {string} videoId - YouTube video ID
 * @property {VideoMetadata} metadata - Video metadata
 * @property {ExtractionPreferences} preferences - User preferences
 * @property {number} startTime - Processing start timestamp
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {false} success - Always false for errors
 * @property {string} error - Error message
 * @property {string} code - Error code
 * @property {string} message - Human-readable message
 * @property {string} [hint] - Helpful hint for resolving the error
 * @property {number} [retryAfter] - Seconds to wait before retrying
 * @property {string[]} [supportedFormats] - List of supported formats
 * @property {string[]} [availableLanguages] - List of available languages
 */

// Error codes constants
export const ERROR_CODES = {
  // Validation errors (400)
  INVALID_URL: 'INVALID_URL',
  INVALID_VIDEO_ID: 'INVALID_VIDEO_ID',
  MISSING_PARAMETERS: 'MISSING_PARAMETERS',
  
  // Video availability errors (404/403)
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  VIDEO_PRIVATE: 'VIDEO_PRIVATE',
  VIDEO_RESTRICTED: 'VIDEO_RESTRICTED',
  
  // Extraction errors (500/502)
  NO_CAPTIONS_AVAILABLE: 'NO_CAPTIONS_AVAILABLE',
  AUDIO_DOWNLOAD_FAILED: 'AUDIO_DOWNLOAD_FAILED',
  WHISPER_API_ERROR: 'WHISPER_API_ERROR',
  ALL_METHODS_FAILED: 'ALL_METHODS_FAILED',
  
  // Rate limiting errors (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED'
};

// Supported formats
export const SUPPORTED_FORMATS = ['txt', 'srt', 'json'];

// Default preferences
export const DEFAULT_PREFERENCES = {
  preferredLanguage: 'en',
  format: 'txt',
  fallbackToAudio: true
};