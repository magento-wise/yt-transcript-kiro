// services/unified-extractor.js
// Unified transcript extractor with intelligent fallback mechanism

import { YoutubeTranscript } from 'youtube-transcript';
import { getSubtitles, getVideoDetails } from 'youtube-caption-extractor';
import OpenAI from 'openai';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { ERROR_CODES } from '../types/interfaces.js';
import { TRANSCRIPT_METHODS } from './strategy-selector.js';
import { languageHandler } from './language-handler.js';

/**
 * UnifiedTranscriptExtractor class that wraps all extraction methods
 */
export class UnifiedTranscriptExtractor {
  constructor() {
    this.openai = null;
    this._initializeOpenAI();
  }

  /**
   * Initialize OpenAI client if API key is available
   * @private
   */
  _initializeOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Extract transcript using specified method
   * @param {string} videoId - YouTube video ID
   * @param {TranscriptMethod} method - Extraction method to use
   * @param {Object} config - Method-specific configuration
   * @returns {Promise<TranscriptResult>}
   */
  async extractTranscript(videoId, method, config = {}) {
    const startTime = Date.now();
    
    console.log(`🚀 Extracting transcript using method: ${method}`);
    console.log(`🎬 Video ID: ${videoId}`);
    
    try {
      let result;
      
      switch (method) {
        case TRANSCRIPT_METHODS.YOUTUBE_TRANSCRIPT:
          result = await this._extractWithYouTubeTranscript(videoId, config);
          break;
          
        case TRANSCRIPT_METHODS.YOUTUBE_CAPTION_EXTRACTOR:
          result = await this._extractWithCaptionExtractor(videoId, config);
          break;
          
        case TRANSCRIPT_METHODS.WHISPER_AUDIO:
          result = await this._extractWithWhisperAudio(videoId, config);
          break;
          
        default:
          throw new Error(`Unsupported extraction method: ${method}`);
      }
      
      const extractionTime = Date.now() - startTime;
      
      return {
        ...result,
        success: true,
        method: method,
        extractionTime
      };
      
    } catch (error) {
      const extractionTime = Date.now() - startTime;
      
      console.error(`❌ Method ${method} failed:`, error.message);
      
      return {
        success: false,
        transcript: '',
        format: config.format || 'txt',
        language: config.language || 'en',
        method: method,
        error: error.message,
        extractionTime
      };
    }
  }

  /**
   * Extract transcript with intelligent fallback mechanism
   * @param {string} videoId - YouTube video ID
   * @param {TranscriptMethod[]} methods - Ordered list of methods to try
   * @param {Object} config - Configuration object
   * @returns {Promise<TranscriptResult>}
   */
  async extractWithFallback(videoId, methods, config = {}) {
    console.log(`🔄 Starting fallback extraction for ${videoId}`);
    console.log(`📋 Methods to try: ${methods.join(' → ')}`);
    
    const errors = [];
    
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      console.log(`\n🔄 Attempting method ${i + 1}/${methods.length}: ${method}`);
      
      try {
        const result = await this.extractTranscript(videoId, method, config);
        
        if (result.success && result.transcript && result.transcript.length > 50) {
          console.log(`✅ Success with ${method}!`);
          console.log(`📊 Transcript length: ${result.transcript.length} characters`);
          return result;
        } else {
          console.log(`⚠️ ${method} returned insufficient content`);
          errors.push(`${method}: Insufficient content (${result.transcript?.length || 0} chars)`);
        }
        
      } catch (error) {
        console.log(`❌ ${method} failed: ${error.message}`);
        errors.push(`${method}: ${error.message}`);
      }
    }
    
    // All methods failed
    console.log(`❌ All extraction methods failed for ${videoId}`);
    
    const error = new Error(`All extraction methods failed. Errors: ${errors.join('; ')}`);
    error.code = ERROR_CODES.ALL_METHODS_FAILED;
    
    return {
      success: false,
      transcript: '',
      format: config.format || 'txt',
      language: config.language || 'en',
      method: 'none',
      error: error.message,
      extractionTime: 0
    };
  }

  /**
   * Extract transcript using youtube-transcript library
   * @param {string} videoId - YouTube video ID
   * @param {Object} config - Configuration
   * @returns {Promise<Object>}
   * @private
   */
  async _extractWithYouTubeTranscript(videoId, config) {
    console.log(`📥 Using youtube-transcript method`);
    
    const methods = [
      {
        name: 'youtube-transcript with language',
        fn: () => YoutubeTranscript.fetchTranscript(videoId, { 
          lang: config.language, 
          country: config.country || 'US' 
        })
      },
      {
        name: 'youtube-transcript without language',
        fn: () => YoutubeTranscript.fetchTranscript(videoId)
      }
    ];
    
    // Try fallback languages if provided
    if (config.fallbackLanguages && config.fallbackLanguages.length > 0) {
      config.fallbackLanguages.forEach(lang => {
        methods.push({
          name: `youtube-transcript with ${lang}`,
          fn: () => YoutubeTranscript.fetchTranscript(videoId, { lang, country: 'US' })
        });
      });
    }
    
    for (const method of methods) {
      try {
        console.log(`🔄 Trying ${method.name}...`);
        const transcript = await method.fn();
        
        if (transcript && transcript.length > 0) {
          console.log(`✅ Success with ${method.name}`);
          return this._formatTranscriptResult(transcript, config, 'youtube-transcript');
        }
      } catch (error) {
        console.log(`⚠️ ${method.name} failed: ${error.message}`);
      }
    }
    
    throw new Error('youtube-transcript: No transcript data available');
  }

  /**
   * Extract transcript using youtube-caption-extractor
   * @param {string} videoId - YouTube video ID
   * @param {Object} config - Configuration
   * @returns {Promise<Object>}
   * @private
   */
  async _extractWithCaptionExtractor(videoId, config) {
    console.log(`📥 Using youtube-caption-extractor method`);
    
    try {
      let subtitles;
      let usedLanguage = config.language;
      
      // Try with language configuration if available
      if (config.languageConfig && config.languageConfig.fallbackLanguages) {
        const languages = [config.language, ...config.languageConfig.fallbackLanguages];
        
        for (const lang of languages) {
          try {
            console.log(`🔄 Trying language: ${lang}`);
            subtitles = await getSubtitles({ videoID: videoId, lang: lang });
            usedLanguage = lang;
            console.log(`✅ Success with language: ${lang}`);
            break;
          } catch (error) {
            console.log(`⚠️ Language ${lang} failed: ${error.message}`);
          }
        }
      } else {
        // Fallback to original method
        try {
          subtitles = await getSubtitles({ videoID: videoId, lang: config.language });
        } catch (error) {
          console.log(`⚠️ Language ${config.language} failed, trying without language`);
          subtitles = await getSubtitles({ videoID: videoId });
          usedLanguage = 'auto-detected';
        }
      }
      
      if (!subtitles || subtitles.length === 0) {
        throw new Error('No subtitles found');
      }
      
      console.log(`✅ Found ${subtitles.length} subtitle segments using language: ${usedLanguage}`);
      
      // Get video details for additional info
      let videoDetails = null;
      try {
        videoDetails = await getVideoDetails({ videoID: videoId });
      } catch (error) {
        console.log(`⚠️ Could not get video details: ${error.message}`);
      }
      
      const result = this._formatTranscriptResult(subtitles, config, 'youtube-caption-extractor', videoDetails);
      result.language = usedLanguage; // Update with actually used language
      
      return result;
      
    } catch (error) {
      throw new Error(`youtube-caption-extractor: ${error.message}`);
    }
  }

  /**
   * Extract transcript using Whisper audio transcription
   * @param {string} videoId - YouTube video ID
   * @param {Object} config - Configuration
   * @returns {Promise<Object>}
   * @private
   */
  async _extractWithWhisperAudio(videoId, config) {
    console.log(`🤖 Using Whisper audio transcription method`);
    
    if (!this.openai) {
      throw new Error('OpenAI API key not configured for audio transcription');
    }
    
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Step 1: Download audio
    console.log(`📥 Step 1: Downloading audio...`);
    const audioBuffer = await this._downloadYouTubeAudio(videoUrl);
    
    if (!audioBuffer || audioBuffer.byteLength < 1000000) {
      throw new Error(`Audio too small (${audioBuffer?.byteLength || 0} bytes) - likely not real content`);
    }
    
    console.log(`✅ Audio downloaded: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    
    // Step 2: Transcribe with Whisper
    console.log(`🚀 Step 2: Transcribing with Whisper...`);
    const whisperResult = await this._transcribeWithWhisper(audioBuffer, config);
    
    return {
      transcript: whisperResult.text,
      language: whisperResult.language || config.language || 'en',
      confidence: 0.95, // Whisper generally has high confidence
      segments: whisperResult.segments || [],
      audioSizeBytes: audioBuffer.byteLength,
      format: config.format || 'txt'
    };
  }

  /**
   * Download YouTube audio using ytdl-core
   * @param {string} videoUrl - YouTube video URL
   * @returns {Promise<ArrayBuffer>}
   * @private
   */
  async _downloadYouTubeAudio(videoUrl) {
    const userAgent = process.env.YTDL_UA || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36';
    
    const headers = {
      'user-agent': userAgent,
      'accept-language': 'en-US,en;q=0.9',
      'referer': videoUrl,
      'origin': 'https://www.youtube.com'
    };
    
    if (process.env.YTDL_COOKIE) {
      headers.cookie = process.env.YTDL_COOKIE;
    }
    
    // Get video info
    const info = await ytdl.getInfo(videoUrl, { requestOptions: { headers } });
    
    // Choose best audio format
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestaudio', 
      filter: 'audioonly' 
    });
    
    if (!format) {
      throw new Error('No suitable audio format found');
    }
    
    // Create temporary file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-audio-'));
    const audioPath = path.join(tmpDir, 'audio.webm');
    
    try {
      // Download audio
      const audioStream = ytdl.downloadFromInfo(info, {
        format: format,
        requestOptions: { headers },
        highWaterMark: 1 << 26 // 64MB buffer
      });
      
      await pipeline(audioStream, fs.createWriteStream(audioPath));
      
      // Read file as buffer
      const audioBuffer = fs.readFileSync(audioPath);
      
      // Clean up
      fs.rmSync(tmpDir, { recursive: true, force: true });
      
      return audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength);
      
    } catch (error) {
      // Clean up on error
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
      throw error;
    }
  }

  /**
   * Transcribe audio buffer with OpenAI Whisper
   * @param {ArrayBuffer} audioBuffer - Audio data
   * @param {Object} config - Configuration
   * @returns {Promise<Object>}
   * @private
   */
  async _transcribeWithWhisper(audioBuffer, config) {
    // Create temporary file for Whisper API
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-'));
    const audioPath = path.join(tmpDir, 'audio.webm');
    
    try {
      // Write buffer to file
      fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
      
      // Prepare Whisper API call with language detection
      const transcriptionConfig = {
        file: fs.createReadStream(audioPath),
        model: config.model || 'whisper-1',
        response_format: config.response_format || 'verbose_json'
      };
      
      // Add language hint if available and confidence is high enough
      if (config.languageHint && config.languageConfig?.matchConfidence > 0.7) {
        transcriptionConfig.language = languageHandler.normalizeLanguageCode(config.languageHint);
        console.log(`🌍 Using language hint: ${transcriptionConfig.language}`);
      } else if (config.language && config.language !== 'auto') {
        transcriptionConfig.language = languageHandler.normalizeLanguageCode(config.language);
        console.log(`🌍 Using specified language: ${transcriptionConfig.language}`);
      } else {
        console.log(`🌍 Using auto-detection (no language specified)`);
      }
      
      if (config.timestamp_granularities) {
        transcriptionConfig.timestamp_granularities = config.timestamp_granularities;
      }
      
      // Call Whisper API
      const response = await this.openai.audio.transcriptions.create(transcriptionConfig);
      
      // Clean up
      fs.rmSync(tmpDir, { recursive: true, force: true });
      
      return response;
      
    } catch (error) {
      // Clean up on error
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
      
      throw new Error(`Whisper API error: ${error.message}`);
    }
  }

  /**
   * Format transcript result into consistent structure
   * @param {Array} rawTranscript - Raw transcript data
   * @param {Object} config - Configuration
   * @param {string} source - Source method
   * @param {Object} videoDetails - Optional video details
   * @returns {Object}
   * @private
   */
  _formatTranscriptResult(rawTranscript, config, source, videoDetails = null) {
    const format = config.format || 'txt';
    
    // Convert to standard segment format
    const segments = rawTranscript.map(item => ({
      text: item.text,
      start: item.offset || (parseFloat(item.start) * 1000) || 0,
      duration: item.duration || (parseFloat(item.dur) * 1000) || 0
    }));
    
    // Generate different output formats
    let transcript;
    if (format === 'srt') {
      transcript = this._formatAsSrt(segments);
    } else if (format === 'json') {
      transcript = JSON.stringify({ segments, source, videoDetails }, null, 2);
    } else {
      transcript = segments.map(s => s.text).join(' ');
    }
    
    return {
      transcript,
      language: config.language || 'en',
      confidence: 0.9, // Caption-based methods generally have high confidence
      segments,
      format,
      source
    };
  }

  /**
   * Format segments as SRT subtitle format
   * @param {Array} segments - Transcript segments
   * @returns {string}
   * @private
   */
  _formatAsSrt(segments) {
    return segments.map((segment, index) => {
      const startTime = this._formatSrtTime(segment.start);
      const endTime = this._formatSrtTime(segment.start + segment.duration);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    }).join('\n');
  }

  /**
   * Format time for SRT format
   * @param {number} milliseconds - Time in milliseconds
   * @returns {string}
   * @private
   */
  _formatSrtTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = milliseconds % 1000;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}

// Export singleton instance
export const unifiedExtractor = new UnifiedTranscriptExtractor();