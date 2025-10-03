// utils/youtube-validator.js
// YouTube URL validation and normalization utilities

/**
 * Validates and extracts video ID from various YouTube URL formats
 * @param {string} input - YouTube URL or video ID
 * @returns {ValidationResult}
 */
export function validateYouTubeUrl(input) {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      error: 'Input must be a non-empty string'
    };
  }

  const trimmedInput = input.trim();
  
  // Try to extract video ID
  const videoId = extractVideoId(trimmedInput);
  
  if (!videoId) {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      error: 'Invalid YouTube URL format or video ID'
    };
  }

  // Validate video ID format
  if (!isValidVideoId(videoId)) {
    return {
      isValid: false,
      videoId: videoId,
      normalizedUrl: null,
      error: 'Invalid video ID format (must be 11 characters)'
    };
  }

  const normalizedUrl = normalizeYouTubeUrl(trimmedInput);

  return {
    isValid: true,
    videoId: videoId,
    normalizedUrl: normalizedUrl,
    error: null
  };
}

/**
 * Extracts video ID from various YouTube URL formats
 * @param {string} input - YouTube URL or video ID
 * @returns {string|null} - Video ID or null if not found
 */
export function extractVideoId(input) {
  if (!input) return null;

  // If input is already a video ID (11 characters, alphanumeric + - and _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // YouTube watch URL: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // YouTube short URL: https://youtu.be/VIDEO_ID
  const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // YouTube embed URL: https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = input.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // YouTube shorts URL: https://www.youtube.com/shorts/VIDEO_ID
  const shortsMatch = input.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  return null;
}

/**
 * Normalizes YouTube URL to standard watch format
 * @param {string} input - YouTube URL or video ID
 * @returns {string} - Normalized YouTube URL
 */
export function normalizeYouTubeUrl(input) {
  const videoId = extractVideoId(input);
  if (!videoId) return input;
  
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Validates video ID format (11 characters, alphanumeric + - and _)
 * @param {string} videoId - Video ID to validate
 * @returns {boolean} - True if valid format
 */
export function isValidVideoId(videoId) {
  if (!videoId || typeof videoId !== 'string') return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/**
 * Determines the type of YouTube URL
 * @param {string} input - YouTube URL
 * @returns {string} - URL type (watch, short, embed, shorts, videoId, invalid)
 */
export function getUrlType(input) {
  if (!input) return 'invalid';

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return 'videoId';
  if (input.includes('youtube.com/watch')) return 'watch';
  if (input.includes('youtu.be/')) return 'short';
  if (input.includes('youtube.com/embed/')) return 'embed';
  if (input.includes('youtube.com/shorts/')) return 'shorts';
  
  return 'invalid';
}