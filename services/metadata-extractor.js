// services/metadata-extractor.js
// Video metadata extraction service using ytdl-core

import ytdl from '@distube/ytdl-core';
import { ERROR_CODES } from '../types/interfaces.js';

/**
 * VideoMetadataExtractor class for fetching YouTube video information
 */
export class VideoMetadataExtractor {
  constructor() {
    this.userAgent = process.env.YTDL_UA || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36';
    
    this.cookieHeader = process.env.YTDL_COOKIE || '';
    this.idToken = process.env.YTDL_ID_TOKEN || '';
  }

  /**
   * Get comprehensive video metadata
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<VideoMetadata>}
   */
  async getVideoMetadata(videoId) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      // Check if URL is valid first
      if (!ytdl.validateURL(videoUrl)) {
        throw new Error('Invalid YouTube URL');
      }

      const headers = this._getRequestHeaders(videoId);
      const info = await this._getInfoRobust(videoUrl, headers);
      
      if (!info || !info.videoDetails) {
        throw new Error('No video details found');
      }

      const videoDetails = info.videoDetails;
      const playerResponse = info.player_response || {};
      
      // Extract caption information
      const captionInfo = this._extractCaptionInfo(playerResponse);
      
      return {
        videoId: videoDetails.videoId,
        title: videoDetails.title || 'Unknown Title',
        description: videoDetails.description || '',
        duration: parseInt(videoDetails.lengthSeconds) || 0,
        isLive: videoDetails.isLiveContent || false,
        isUpcoming: videoDetails.isUpcoming || false,
        hasClosedCaptions: captionInfo.hasClosedCaptions,
        availableLanguages: captionInfo.availableLanguages,
        thumbnailUrl: this._getBestThumbnail(videoDetails.thumbnails),
        channelName: videoDetails.author || videoDetails.ownerChannelName || 'Unknown Channel',
        publishDate: videoDetails.publishDate || videoDetails.uploadDate || 'Unknown'
      };

    } catch (error) {
      console.error(`Failed to get metadata for ${videoId}:`, error.message);
      throw this._createMetadataError(error);
    }
  }

  /**
   * Check video availability status
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<AvailabilityStatus>}
   */
  async checkVideoAvailability(videoId) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      if (!ytdl.validateURL(videoUrl)) {
        return {
          isAvailable: false,
          isPrivate: false,
          isRestricted: false,
          error: 'Invalid video URL format'
        };
      }

      const headers = this._getRequestHeaders(videoId);
      const info = await this._getInfoRobust(videoUrl, headers);
      
      if (!info || !info.videoDetails) {
        return {
          isAvailable: false,
          isPrivate: false,
          isRestricted: false,
          error: 'Video not found or inaccessible'
        };
      }

      const videoDetails = info.videoDetails;
      
      // Check various availability conditions
      const isPrivate = videoDetails.isPrivate || false;
      const isUnlisted = videoDetails.isUnlisted || false;
      const isLive = videoDetails.isLiveContent || false;
      const isUpcoming = videoDetails.isUpcoming || false;
      
      // Check for age restrictions or other limitations
      const isRestricted = this._checkRestrictions(info);
      
      return {
        isAvailable: true,
        isPrivate: isPrivate || isUnlisted,
        isRestricted: isRestricted,
        error: null
      };

    } catch (error) {
      console.error(`Failed to check availability for ${videoId}:`, error.message);
      
      // Determine specific error type
      if (error.message.includes('Video unavailable')) {
        return {
          isAvailable: false,
          isPrivate: false,
          isRestricted: false,
          error: 'Video is unavailable'
        };
      }
      
      if (error.message.includes('Private video')) {
        return {
          isAvailable: false,
          isPrivate: true,
          isRestricted: false,
          error: 'Video is private'
        };
      }
      
      return {
        isAvailable: false,
        isPrivate: false,
        isRestricted: true,
        error: error.message
      };
    }
  }

  /**
   * Get request headers for YouTube API calls
   * @param {string} videoId - YouTube video ID
   * @returns {Object} - Request headers
   * @private
   */
  _getRequestHeaders(videoId) {
    const headers = {
      'user-agent': this.userAgent,
      'accept-language': 'en-US,en;q=0.9',
      'referer': `https://www.youtube.com/watch?v=${videoId}`,
      'origin': 'https://www.youtube.com'
    };

    if (this.cookieHeader) {
      headers.cookie = this.cookieHeader;
    }

    if (this.idToken) {
      headers['x-youtube-identity-token'] = this.idToken;
    }

    return headers;
  }

  /**
   * Robust method to get video info with multiple client fallbacks
   * @param {string} url - YouTube video URL
   * @param {Object} headers - Request headers
   * @returns {Promise<Object>} - Video info
   * @private
   */
  async _getInfoRobust(url, headers) {
    const clients = (process.env.YTDL_CLIENTS || 'ANDROID,IOS,WEB')
      .split(',')
      .map(s => s.trim().toUpperCase());
    
    let lastError;
    
    for (const client of clients) {
      try {
        if (ytdl.setDefaultClient) {
          ytdl.setDefaultClient(client);
        }
        
        return await ytdl.getInfo(url, { 
          requestOptions: { headers }
        });
      } catch (error) {
        lastError = error;
        console.log(`Client ${client} failed:`, error.message);
      }
    }
    
    throw lastError || new Error('All ytdl clients failed');
  }

  /**
   * Extract caption information from player response
   * @param {Object} playerResponse - YouTube player response
   * @returns {Object} - Caption info
   * @private
   */
  _extractCaptionInfo(playerResponse) {
    try {
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      
      if (!captions || !Array.isArray(captions) || captions.length === 0) {
        return {
          hasClosedCaptions: false,
          availableLanguages: []
        };
      }

      const availableLanguages = captions.map(caption => {
        return caption.languageCode || caption.vssId || 'unknown';
      }).filter(lang => lang !== 'unknown');

      return {
        hasClosedCaptions: true,
        availableLanguages: [...new Set(availableLanguages)] // Remove duplicates
      };

    } catch (error) {
      console.log('Failed to extract caption info:', error.message);
      return {
        hasClosedCaptions: false,
        availableLanguages: []
      };
    }
  }

  /**
   * Get the best quality thumbnail URL
   * @param {Array} thumbnails - Array of thumbnail objects
   * @returns {string} - Best thumbnail URL
   * @private
   */
  _getBestThumbnail(thumbnails) {
    if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) {
      return '';
    }

    // Sort by resolution (width * height) and get the highest
    const sortedThumbnails = thumbnails
      .filter(thumb => thumb.url)
      .sort((a, b) => (b.width * b.height) - (a.width * a.height));

    return sortedThumbnails[0]?.url || '';
  }

  /**
   * Check for various video restrictions
   * @param {Object} info - Video info object
   * @returns {boolean} - True if video has restrictions
   * @private
   */
  _checkRestrictions(info) {
    try {
      const videoDetails = info.videoDetails;
      const playerResponse = info.player_response || {};
      
      // Check for age restrictions
      if (videoDetails.age_restricted || playerResponse.contentCheckOk === false) {
        return true;
      }
      
      // Check for geographic restrictions
      if (playerResponse.playabilityStatus?.status === 'UNPLAYABLE') {
        return true;
      }
      
      // Check for other playability issues
      const playabilityStatus = playerResponse.playabilityStatus?.status;
      if (playabilityStatus && playabilityStatus !== 'OK') {
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('Error checking restrictions:', error.message);
      return false;
    }
  }

  /**
   * Create appropriate error for metadata extraction failures
   * @param {Error} error - Original error
   * @returns {Error} - Formatted error
   * @private
   */
  _createMetadataError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('video unavailable') || message.includes('not found')) {
      const err = new Error('Video not found or unavailable');
      err.code = ERROR_CODES.VIDEO_NOT_FOUND;
      return err;
    }
    
    if (message.includes('private') || message.includes('access denied')) {
      const err = new Error('Video is private or access denied');
      err.code = ERROR_CODES.VIDEO_PRIVATE;
      return err;
    }
    
    if (message.includes('restricted') || message.includes('blocked')) {
      const err = new Error('Video is restricted or blocked');
      err.code = ERROR_CODES.VIDEO_RESTRICTED;
      return err;
    }
    
    // Generic error
    const err = new Error(`Failed to extract video metadata: ${error.message}`);
    err.code = ERROR_CODES.VIDEO_NOT_FOUND;
    return err;
  }
}

// Export singleton instance
export const metadataExtractor = new VideoMetadataExtractor();