// backend/index-enhanced.js
// Enhanced version with multi-method transcript extraction

import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import zlib from "zlib";

// Import our enhanced YouTube validator system
import { validateYouTubeUrl } from './utils/youtube-validator.js';
import { VideoMetadataExtractor } from './services/metadata-extractor.js';
import { TranscriptStrategySelector } from './services/strategy-selector.js';
import { UnifiedTranscriptExtractor } from './services/unified-extractor.js';
import { ResponseFormatter } from './services/response-formatter.js';

const app = express();
app.use(cors({ origin: "*", exposedHeaders: ["X-Transcript-Source", "Content-Disposition"] }));
app.use((req, res, next) => {
  req.setTimeout(0);
  res.setTimeout(0);
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  next();
});
app.use(compression({ threshold: 1024 }));

// Initialize our services
const metadataExtractor = new VideoMetadataExtractor();
const strategySelector = new TranscriptStrategySelector();
const transcriptExtractor = new UnifiedTranscriptExtractor();
const responseFormatter = new ResponseFormatter();

// Helper to send gzipped responses
function sendGzippedText(res, filename, text, source = "enhanced") {
  const buf = Buffer.isBuffer(text) ? text : Buffer.from(String(text), "utf8");
  const gz = zlib.gzipSync(buf, { level: zlib.constants.Z_BEST_COMPRESSION });
  res.setHeader("X-Transcript-Source", source);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Encoding", "gzip");
  res.setHeader("Content-Length", String(gz.length));
  res.end(gz);
}

function sendGzippedJson(res, data, source = "enhanced") {
  const json = JSON.stringify(data, null, 2);
  const gz = zlib.gzipSync(Buffer.from(json, "utf8"), { level: zlib.constants.Z_BEST_COMPRESSION });
  res.setHeader("X-Transcript-Source", source);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Encoding", "gzip");
  res.setHeader("Content-Length", String(gz.length));
  res.end(gz);
}

app.get("/health", (_req, res) => res.json({ 
  ok: true, 
  version: "enhanced",
  methods: ["youtube-transcript", "youtube-caption-extractor", "whisper-audio"]
}));

// Enhanced transcript endpoint with multiple extraction methods
app.get("/transcript", async (req, res) => {
  const startTime = Date.now();
  const { 
    url, 
    format = "txt", 
    lang = "en", 
    wrap,
    method = "auto", // auto, youtube-transcript, youtube-caption-extractor, whisper-audio
    fallbackToAudio = "true"
  } = req.query || {};

  try {
    // Step 1: Validate URL
    if (!url) {
      const { response, httpStatus } = responseFormatter.formatValidationError(
        'url', '', 'URL parameter is required'
      );
      return res.status(httpStatus).json(response);
    }

    console.log(`🎬 Processing: ${url}`);
    
    const urlValidation = validateYouTubeUrl(url);
    if (!urlValidation.isValid) {
      const { response, httpStatus } = responseFormatter.formatValidationError(
        'url', url, urlValidation.error
      );
      return res.status(httpStatus).json(response);
    }

    const videoId = urlValidation.videoId;
    console.log(`✅ Valid video ID: ${videoId}`);

    // Step 2: Get video metadata (optional - continue if it fails)
    let metadata = null;
    try {
      console.log(`🔍 Extracting metadata...`);
      metadata = await metadataExtractor.getVideoMetadata(videoId);
      console.log(`✅ Metadata extracted: ${metadata.title}`);
    } catch (metadataError) {
      console.log(`⚠️ Metadata extraction failed: ${metadataError.message}`);
      console.log(`⚠️ Continuing with transcript extraction anyway...`);
      // Create minimal metadata object
      metadata = {
        videoId: videoId,
        title: `Video ${videoId}`,
        hasClosedCaptions: false,
        availableLanguages: []
      };
    }

    // Step 3: Determine extraction strategy
    const preferences = {
      preferredLanguage: lang,
      format: format,
      fallbackToAudio: fallbackToAudio === "true"
    };

    let strategies;
    if (method === "auto") {
      // If no captions detected or metadata failed, prioritize transcript methods that don't need metadata
      if (!metadata.hasClosedCaptions || metadata.title.startsWith('Video ')) {
        strategies = ['youtube-transcript', 'youtube-caption-extractor'];
        if (fallbackToAudio === "true") {
          strategies.push('whisper-audio');
        }
      } else {
        strategies = strategySelector.selectStrategy(metadata, preferences);
      }
    } else {
      // Force specific method
      strategies = [method];
      if (fallbackToAudio === "true" && method !== "whisper-audio") {
        strategies.push("whisper-audio");
      }
    }

    console.log(`🎯 Using strategies: ${strategies.join(' → ')}`);

    // Step 4: Extract transcript
    console.log(`📝 Extracting transcript...`);
    const config = strategySelector.getMethodConfig(strategies[0], metadata, preferences);

    const result = await transcriptExtractor.extractWithFallback(videoId, strategies, config);

    if (!result.success) {
      const error = new Error(result.error);
      const { response, httpStatus } = responseFormatter.formatError(error, 'extraction');
      return res.status(httpStatus).json(response);
    }

    console.log(`✅ Transcript extracted using ${result.method} (${result.extractionTime}ms)`);

    // Step 5: Format response
    const formattedResponse = responseFormatter.formatResponse(result, metadata, preferences);
    
    // Add processing time
    formattedResponse.data.totalProcessingTime = Date.now() - startTime;

    // Return based on requested format
    if (wrap === "json") {
      return sendGzippedJson(res, formattedResponse, result.method);
    }

    // Return raw transcript
    const filename = `${videoId}.${format === 'srt' ? 'srt' : 'txt'}`;
    return sendGzippedText(res, filename, result.transcript, result.method);

  } catch (error) {
    console.error(`❌ Error processing ${url}:`, error.message);
    
    const { response, httpStatus } = responseFormatter.formatError(error, 'processing');
    return res.status(httpStatus).json(response);
  }
});

// Legacy endpoint for backward compatibility
app.get("/transcript-legacy", async (req, res) => {
  // Your original implementation here for backward compatibility
  // This ensures existing integrations continue to work
  res.redirect(301, `/transcript?${new URLSearchParams(req.query).toString()}&method=whisper-audio`);
});

// New endpoint for video information only
app.get("/video-info", async (req, res) => {
  const { url } = req.query || {};

  try {
    if (!url) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    const urlValidation = validateYouTubeUrl(url);
    if (!urlValidation.isValid) {
      return res.status(400).json({ error: urlValidation.error });
    }

    const metadata = await metadataExtractor.getVideoMetadata(urlValidation.videoId);
    const availability = await metadataExtractor.checkVideoAvailability(urlValidation.videoId);

    const response = {
      success: true,
      data: {
        videoId: metadata.videoId,
        title: metadata.title,
        duration: metadata.duration,
        channelName: metadata.channelName,
        publishDate: metadata.publishDate,
        hasClosedCaptions: metadata.hasClosedCaptions,
        availableLanguages: metadata.availableLanguages,
        thumbnailUrl: metadata.thumbnailUrl,
        isAvailable: availability.isAvailable,
        isPrivate: availability.isPrivate,
        isRestricted: availability.isRestricted
      }
    };

    return sendGzippedJson(res, response, "metadata");

  } catch (error) {
    const { response, httpStatus } = responseFormatter.formatError(error, 'metadata');
    return res.status(httpStatus).json(response);
  }
});

// Endpoint to get available extraction methods for a video
app.get("/extraction-methods", async (req, res) => {
  const { url, lang = "en" } = req.query || {};

  try {
    if (!url) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    const urlValidation = validateYouTubeUrl(url);
    if (!urlValidation.isValid) {
      return res.status(400).json({ error: urlValidation.error });
    }

    const metadata = await metadataExtractor.getVideoMetadata(urlValidation.videoId);
    const preferences = { preferredLanguage: lang, fallbackToAudio: true };
    
    const strategies = strategySelector.selectStrategy(metadata, preferences);
    const primaryStrategy = strategySelector.getPrimaryStrategy(metadata, preferences);

    const methodDetails = strategies.map(method => ({
      method,
      estimatedTime: strategySelector.estimateExtractionTime(method, metadata),
      recommended: method === primaryStrategy,
      config: strategySelector.getMethodConfig(method, metadata, preferences)
    }));

    const response = {
      success: true,
      data: {
        videoId: metadata.videoId,
        title: metadata.title,
        hasClosedCaptions: metadata.hasClosedCaptions,
        availableLanguages: metadata.availableLanguages,
        recommendedMethod: primaryStrategy,
        availableMethods: methodDetails
      }
    };

    return sendGzippedJson(res, response, "strategy");

  } catch (error) {
    const { response, httpStatus } = responseFormatter.formatError(error, 'strategy');
    return res.status(httpStatus).json(response);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Enhanced YouTube Transcript API listening on :${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET /health - Health check`);
  console.log(`   GET /transcript - Enhanced transcript extraction`);
  console.log(`   GET /video-info - Video metadata only`);
  console.log(`   GET /extraction-methods - Available extraction methods`);
  console.log(`   GET /transcript-legacy - Legacy endpoint (redirects)`);
});