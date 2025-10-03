// services/response-formatter.js
// Response formatting and error handling service

import { ERROR_CODES, SUPPORTED_FORMATS } from '../types/interfaces.js';

/**
 * ResponseFormatter class for consistent API responses
 */
export class ResponseFormatter {
  constructor() {
    this.defaultHints = {
      [ERROR_CODES.INVALID_URL]: 'Please provide a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)',
      [ERROR_CODES.INVALID_VIDEO_ID]: 'Video ID must be exactly 11 characters long and contain only letters, numbers, hyphens, and underscores',
      [ERROR_CODES.MISSING_PARAMETERS]: 'Required parameters: url or videoId',
      [ERROR_CODES.VIDEO_NOT_FOUND]: 'Check if the video exists and is publicly accessible',
      [ERROR_CODES.VIDEO_PRIVATE]: 'This video is private or unlisted and cannot be accessed',
      [ERROR_CODES.VIDEO_RESTRICTED]: 'This video may have age restrictions or geographic limitations',
      [ERROR_CODES.NO_CAPTIONS_AVAILABLE]: 'Try using fallbackToAudio=true to use audio transcription instead',
      [ERROR_CODES.AUDIO_DOWNLOAD_FAILED]: 'The video audio could not be downloaded. It may be restricted or unavailable',
      [ERROR_CODES.WHISPER_API_ERROR]: 'Check your OpenAI API key and quota limits',
      [ERROR_CODES.ALL_METHODS_FAILED]: 'All transcript extraction methods failed. The video may not have captions and audio may be inaccessible',
      [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Please wait before making another request',
      [ERROR_CODES.QUOTA_EXCEEDED]: 'Daily API quota exceeded. Please try again tomorrow'
    };
  }

  /**
   * Format successful transcript response
   * @param {TranscriptResult} result - Transcript extraction result
   * @param {VideoMetadata} metadata - Video metadata
   * @param {ExtractionPreferences} preferences - User preferences
   * @returns {TranscriptResponse}
   */
  formatResponse(result, metadata, preferences) {
    const response = {
      success: true,
      data: {
        transcript: result.transcript,
        videoId: metadata.videoId,
        videoTitle: metadata.title,
        format: result.format,
        language: result.language,
        method: result.method,
        segments: result.segments?.length || 0,
        extractionTime: result.extractionTime || 0
      },
      message: `Transcript extracted successfully using ${result.method}`
    };

    // Add optional fields if available
    if (metadata.duration) {
      response.data.duration = metadata.duration;
    }

    if (result.confidence !== undefined) {
      response.data.confidence = result.confidence;
    }

    if (result.audioSizeBytes) {
      response.data.audioSizeBytes = result.audioSizeBytes;
    }

    // Add metadata for JSON format
    if (preferences.format === 'json') {
      response.data.metadata = {
        channelName: metadata.channelName,
        publishDate: metadata.publishDate,
        thumbnailUrl: metadata.thumbnailUrl,
        hasClosedCaptions: metadata.hasClosedCaptions,
        availableLanguages: metadata.availableLanguages,
        requestedLanguage: preferences.preferredLanguage,
        detectedLanguage: result.language
      };
    }
    
    // Always include available languages for language-aware clients
    response.data.availableLanguages = metadata.availableLanguages;

    return response;
  }

  /**
   * Format error response with appropriate HTTP status code
   * @param {Error} error - Error object
   * @param {string} context - Context where error occurred
   * @param {Object} additionalInfo - Additional error information
   * @returns {Object} - Formatted error response with HTTP status
   */
  formatError(error, context = 'unknown', additionalInfo = {}) {
    if (!error) {
      error = { message: 'Unknown error occurred' };
    }
    if (error.message === undefined || error.message === null) {
      error.message = 'Unknown error occurred';
    }
    const errorCode = error.code || this._determineErrorCode(error.message);
    const httpStatus = this._getHttpStatusForError(errorCode);
    
    const response = {
      success: false,
      error: error.message,
      code: errorCode,
      message: this._getHumanReadableMessage(errorCode, context),
      hint: this._getHintForError(errorCode, error.message)
    };

    // Add context-specific information
    if (additionalInfo.supportedFormats) {
      response.supportedFormats = additionalInfo.supportedFormats;
    }

    if (additionalInfo.availableLanguages) {
      response.availableLanguages = additionalInfo.availableLanguages;
    }

    if (additionalInfo.retryAfter) {
      response.retryAfter = additionalInfo.retryAfter;
    }

    return {
      response,
      httpStatus
    };
  }

  /**
   * Format validation error for invalid requests
   * @param {string} field - Field that failed validation
   * @param {string} value - Invalid value
   * @param {string} reason - Reason for validation failure
   * @returns {Object} - Formatted validation error
   */
  formatValidationError(field, value, reason) {
    const error = new Error(`Invalid ${field}: ${reason}`);
    error.code = ERROR_CODES.INVALID_URL;

    const additionalInfo = {};
    if (field === 'format') {
      additionalInfo.supportedFormats = SUPPORTED_FORMATS;
    }

    return this.formatError(error, 'validation', additionalInfo);
  }

  /**
   * Format rate limiting error
   * @param {number} retryAfter - Seconds to wait before retry
   * @returns {Object} - Formatted rate limit error
   */
  formatRateLimitError(retryAfter = 60) {
    const error = new Error('Rate limit exceeded');
    error.code = ERROR_CODES.RATE_LIMIT_EXCEEDED;

    return this.formatError(error, 'rate_limiting', { retryAfter });
  }

  /**
   * Format method-specific error with fallback suggestions
   * @param {string} method - Failed extraction method
   * @param {Error} error - Original error
   * @param {string[]} remainingMethods - Methods that could still be tried
   * @returns {Object} - Formatted method error
   */
  formatMethodError(method, error, remainingMethods = []) {
    const errorCode = error.code || this._determineErrorCode(error.message);
    const httpStatus = this._getHttpStatusForError(errorCode);

    const response = {
      success: false,
      error: `${method} failed: ${error.message}`,
      code: errorCode,
      message: `Transcript extraction using ${method} failed`,
      hint: this._getMethodSpecificHint(method, error.message)
    };

    if (remainingMethods.length > 0) {
      response.hint += ` Trying fallback methods: ${remainingMethods.join(', ')}`;
    }

    return {
      response,
      httpStatus
    };
  }

  /**
   * Create success response for health checks
   * @returns {Object} - Health check response
   */
  formatHealthResponse() {
    return {
      success: true,
      message: 'YouTube transcript service is healthy',
      timestamp: new Date().toISOString(),
      supportedFormats: SUPPORTED_FORMATS,
      availableMethods: ['youtube-transcript', 'youtube-caption-extractor', 'whisper-audio']
    };
  }

  /**
   * Determine error code from error message
   * @param {string} message - Error message
   * @returns {string} - Error code
   * @private
   */
  _determineErrorCode(message) {
    if (message === undefined || message === null || typeof message !== 'string') {
      return ERROR_CODES.ALL_METHODS_FAILED;
    }
    if (message === '') {
      return ERROR_CODES.ALL_METHODS_FAILED;
    }
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('invalid') && lowerMessage.includes('url')) {
      return ERROR_CODES.INVALID_URL;
    }
    if (lowerMessage.includes('invalid') && lowerMessage.includes('video')) {
      return ERROR_CODES.INVALID_VIDEO_ID;
    }
    if (lowerMessage.includes('not found') || lowerMessage.includes('unavailable')) {
      return ERROR_CODES.VIDEO_NOT_FOUND;
    }
    if (lowerMessage.includes('private') || lowerMessage.includes('access denied')) {
      return ERROR_CODES.VIDEO_PRIVATE;
    }
    if (lowerMessage.includes('restricted') || lowerMessage.includes('blocked')) {
      return ERROR_CODES.VIDEO_RESTRICTED;
    }
    if (lowerMessage.includes('no captions') || lowerMessage.includes('no transcript')) {
      return ERROR_CODES.NO_CAPTIONS_AVAILABLE;
    }
    if (lowerMessage.includes('audio download') || lowerMessage.includes('download failed')) {
      return ERROR_CODES.AUDIO_DOWNLOAD_FAILED;
    }
    if (lowerMessage.includes('whisper') || lowerMessage.includes('openai')) {
      return ERROR_CODES.WHISPER_API_ERROR;
    }
    if (lowerMessage.includes('all methods failed')) {
      return ERROR_CODES.ALL_METHODS_FAILED;
    }
    if (lowerMessage.includes('rate limit')) {
      return ERROR_CODES.RATE_LIMIT_EXCEEDED;
    }
    if (lowerMessage.includes('quota')) {
      return ERROR_CODES.QUOTA_EXCEEDED;
    }

    // Default to generic error
    return ERROR_CODES.ALL_METHODS_FAILED;
  }

  /**
   * Get HTTP status code for error type
   * @param {string} errorCode - Error code
   * @returns {number} - HTTP status code
   * @private
   */
  _getHttpStatusForError(errorCode) {
    switch (errorCode) {
      case ERROR_CODES.INVALID_URL:
      case ERROR_CODES.INVALID_VIDEO_ID:
      case ERROR_CODES.MISSING_PARAMETERS:
        return 400; // Bad Request

      case ERROR_CODES.VIDEO_PRIVATE:
        return 403; // Forbidden

      case ERROR_CODES.VIDEO_NOT_FOUND:
        return 404; // Not Found

      case ERROR_CODES.RATE_LIMIT_EXCEEDED:
      case ERROR_CODES.QUOTA_EXCEEDED:
        return 429; // Too Many Requests

      case ERROR_CODES.NO_CAPTIONS_AVAILABLE:
      case ERROR_CODES.AUDIO_DOWNLOAD_FAILED:
      case ERROR_CODES.WHISPER_API_ERROR:
      case ERROR_CODES.ALL_METHODS_FAILED:
        return 502; // Bad Gateway (external service issue)

      case ERROR_CODES.VIDEO_RESTRICTED:
        return 451; // Unavailable For Legal Reasons

      default:
        return 500; // Internal Server Error
    }
  }

  /**
   * Get human-readable message for error code
   * @param {string} errorCode - Error code
   * @param {string} context - Error context
   * @returns {string} - Human-readable message
   * @private
   */
  _getHumanReadableMessage(errorCode, context) {
    const contextMessages = {
      validation: 'Request validation failed',
      metadata: 'Failed to get video information',
      extraction: 'Transcript extraction failed',
      rate_limiting: 'Request rate limited',
      unknown: 'An error occurred'
    };

    const baseMessage = contextMessages[context] || contextMessages.unknown;

    switch (errorCode) {
      case ERROR_CODES.INVALID_URL:
        return 'The provided URL is not a valid YouTube URL';
      case ERROR_CODES.INVALID_VIDEO_ID:
        return 'The video ID format is invalid';
      case ERROR_CODES.VIDEO_NOT_FOUND:
        return 'The requested video could not be found';
      case ERROR_CODES.VIDEO_PRIVATE:
        return 'The video is private and cannot be accessed';
      case ERROR_CODES.VIDEO_RESTRICTED:
        return 'The video has access restrictions';
      case ERROR_CODES.NO_CAPTIONS_AVAILABLE:
        return 'No captions are available for this video';
      case ERROR_CODES.ALL_METHODS_FAILED:
        return 'All transcript extraction methods failed';
      default:
        return baseMessage;
    }
  }

  /**
   * Get helpful hint for resolving the error
   * @param {string} errorCode - Error code
   * @param {string} errorMessage - Original error message
   * @returns {string} - Helpful hint
   * @private
   */
  _getHintForError(errorCode, errorMessage) {
    const defaultHint = this.defaultHints[errorCode];
    
    if (defaultHint) {
      return defaultHint;
    }

    // Generate contextual hints based on error message
    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      return 'Check your API usage and consider upgrading your plan';
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return 'Check your internet connection and try again';
    }

    return 'Please check the video URL and try again';
  }

  /**
   * Get method-specific hint for extraction failures
   * @param {string} method - Extraction method that failed
   * @param {string} errorMessage - Error message
   * @returns {string} - Method-specific hint
   * @private
   */
  _getMethodSpecificHint(method, errorMessage) {
    switch (method) {
      case 'youtube-transcript':
        return 'The video may not have auto-generated captions available.';
      
      case 'youtube-caption-extractor':
        return 'The video may not have closed captions or they may be in a different format.';
      
      case 'whisper-audio':
        if (errorMessage.includes('API key')) {
          return 'Check your OpenAI API key configuration.';
        }
        if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
          return 'Check your OpenAI API usage and billing.';
        }
        return 'Audio transcription failed. The video audio may be inaccessible.';
      
      default:
        return 'Try using a different extraction method.';
    }
  }
}

// Export singleton instance
export const responseFormatter = new ResponseFormatter();