# Error Codes Reference

This document provides a comprehensive reference for all error codes returned by the YouTube Transcript Extraction API.

## Error Response Format

All errors follow this consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "message": "Context-specific message",
  "hint": "Helpful suggestion for resolving the error"
}
```

## Validation Errors (HTTP 400)

### INVALID_URL
**Description**: The provided URL is not a valid YouTube URL format.

**Common Causes**:
- Malformed URL
- Non-YouTube URL
- Missing protocol (http/https)

**Example**:
```json
{
  "success": false,
  "error": "Invalid YouTube URL format or video ID",
  "code": "INVALID_URL",
  "message": "The provided URL is not a valid YouTube URL",
  "hint": "Please provide a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)"
}
```

**Solutions**:
- Ensure URL starts with `https://www.youtube.com/watch?v=`
- Use supported formats: watch, youtu.be, embed, shorts
- Verify the video ID is 11 characters long

### INVALID_VIDEO_ID
**Description**: The video ID format is invalid.

**Common Causes**:
- Video ID not exactly 11 characters
- Contains invalid characters
- Empty or null video ID

**Example**:
```json
{
  "success": false,
  "error": "Invalid video ID format (must be 11 characters)",
  "code": "INVALID_VIDEO_ID",
  "message": "The video ID format is invalid",
  "hint": "Video ID must be exactly 11 characters long and contain only letters, numbers, hyphens, and underscores"
}
```

**Solutions**:
- Ensure video ID is exactly 11 characters
- Use only alphanumeric characters, hyphens (-), and underscores (_)
- Extract video ID properly from YouTube URLs

### MISSING_PARAMETERS
**Description**: Required parameters are missing from the request.

**Common Causes**:
- Neither `url` nor `videoId` provided
- Empty request body
- Malformed JSON

**Example**:
```json
{
  "success": false,
  "error": "Missing required parameter: url or videoId",
  "code": "MISSING_PARAMETERS",
  "message": "Request validation failed",
  "hint": "Required parameters: url or videoId"
}
```

**Solutions**:
- Provide either `url` or `videoId` parameter
- Ensure request body is valid JSON
- Check parameter names are spelled correctly

## Video Availability Errors

### VIDEO_NOT_FOUND (HTTP 404)
**Description**: The requested video could not be found.

**Common Causes**:
- Video doesn't exist
- Video was deleted
- Incorrect video ID
- Video is not yet processed by YouTube

**Example**:
```json
{
  "success": false,
  "error": "Video not found or unavailable",
  "code": "VIDEO_NOT_FOUND",
  "message": "The requested video could not be found",
  "hint": "Check if the video exists and is publicly accessible"
}
```

**Solutions**:
- Verify the video exists by visiting the URL in a browser
- Check if the video ID is correct
- Ensure the video is not deleted or removed

### VIDEO_PRIVATE (HTTP 403)
**Description**: The video is private or unlisted and cannot be accessed.

**Common Causes**:
- Video set to private by owner
- Video is unlisted and requires direct link
- Account restrictions

**Example**:
```json
{
  "success": false,
  "error": "Video is private or access denied",
  "code": "VIDEO_PRIVATE",
  "message": "The video is private and cannot be accessed",
  "hint": "This video is private or unlisted and cannot be accessed"
}
```

**Solutions**:
- Request video owner to make video public
- Use a different public video
- Cannot be resolved programmatically

### VIDEO_RESTRICTED (HTTP 451)
**Description**: The video has access restrictions.

**Common Causes**:
- Age restrictions
- Geographic restrictions
- Content warnings
- Platform restrictions

**Example**:
```json
{
  "success": false,
  "error": "Video is restricted or blocked",
  "code": "VIDEO_RESTRICTED",
  "message": "The video has access restrictions",
  "hint": "This video may have age restrictions or geographic limitations"
}
```

**Solutions**:
- Use a different video without restrictions
- May require authentication (not supported)
- Geographic restrictions cannot be bypassed

## Extraction Errors (HTTP 502)

### NO_CAPTIONS_AVAILABLE
**Description**: No captions are available for this video.

**Common Causes**:
- Video has no auto-generated captions
- No manual captions uploaded
- Captions disabled by uploader

**Example**:
```json
{
  "success": false,
  "error": "No captions available for this video",
  "code": "NO_CAPTIONS_AVAILABLE",
  "message": "No captions are available for this video",
  "hint": "Try using fallbackToAudio=true to use audio transcription instead"
}
```

**Solutions**:
- Set `fallbackToAudio: true` to use Whisper transcription
- Check if video actually has captions on YouTube
- Try a different video with captions

### AUDIO_DOWNLOAD_FAILED
**Description**: Failed to download audio for transcription.

**Common Causes**:
- Audio stream not accessible
- Network connectivity issues
- YouTube blocking audio access
- Video has no audio track

**Example**:
```json
{
  "success": false,
  "error": "Failed to download audio for transcription",
  "code": "AUDIO_DOWNLOAD_FAILED",
  "message": "Audio transcription failed",
  "hint": "The video audio could not be downloaded. It may be restricted or unavailable"
}
```

**Solutions**:
- Check network connectivity
- Try again later (temporary YouTube restrictions)
- Set YouTube cookies in environment variables
- Use a different video

### WHISPER_API_ERROR
**Description**: OpenAI Whisper API error occurred.

**Common Causes**:
- Invalid or missing OpenAI API key
- Insufficient API credits
- API rate limits exceeded
- Audio file too large or invalid format

**Example**:
```json
{
  "success": false,
  "error": "Whisper API error: Invalid API key",
  "code": "WHISPER_API_ERROR",
  "message": "Audio transcription failed",
  "hint": "Check your OpenAI API key and quota limits"
}
```

**Solutions**:
- Verify OpenAI API key is correct and active
- Check OpenAI account billing and credits
- Ensure API key has audio transcription permissions
- Wait if rate limited

### ALL_METHODS_FAILED
**Description**: All transcript extraction methods failed.

**Common Causes**:
- No captions available AND audio transcription failed
- Multiple system failures
- Video completely inaccessible

**Example**:
```json
{
  "success": false,
  "error": "All extraction methods failed. Errors: youtube-transcript: No transcript available; whisper-audio: API key missing",
  "code": "ALL_METHODS_FAILED",
  "message": "All transcript extraction methods failed",
  "hint": "All transcript extraction methods failed. The video may not have captions and audio may be inaccessible"
}
```

**Solutions**:
- Check individual method requirements
- Ensure OpenAI API key is configured for fallback
- Try a different video
- Check service status

## Rate Limiting Errors (HTTP 429)

### RATE_LIMIT_EXCEEDED
**Description**: API rate limit exceeded.

**Common Causes**:
- Too many requests in short time period
- Concurrent request limits exceeded
- IP-based rate limiting

**Example**:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Request rate limited",
  "hint": "Please wait before making another request",
  "retryAfter": 60
}
```

**Solutions**:
- Wait for the time specified in `retryAfter`
- Implement exponential backoff
- Reduce request frequency
- Use request queuing

### QUOTA_EXCEEDED
**Description**: Daily API quota exceeded.

**Common Causes**:
- OpenAI API quota exhausted
- Service usage limits reached
- Billing issues

**Example**:
```json
{
  "success": false,
  "error": "Daily quota exceeded",
  "code": "QUOTA_EXCEEDED",
  "message": "Daily API quota exceeded",
  "hint": "Daily API quota exceeded. Please try again tomorrow"
}
```

**Solutions**:
- Wait until quota resets (usually 24 hours)
- Upgrade OpenAI plan for higher limits
- Check billing status
- Implement quota monitoring

## Troubleshooting Guide

### Step-by-Step Debugging

1. **Check Video Accessibility**
   ```bash
   # Test if video exists
   curl "https://www.youtube.com/watch?v=VIDEO_ID"
   ```

2. **Validate URL Format**
   ```javascript
   const videoId = url.match(/[?&]v=([^&]+)/)?.[1];
   console.log('Video ID:', videoId);
   ```

3. **Test API Health**
   ```bash
   curl http://localhost:3001/api/youtube-validator
   ```

4. **Check Environment Variables**
   ```bash
   echo $OPENAI_API_KEY
   ```

### Common Error Patterns

| Error Pattern | Likely Cause | Solution |
|---------------|--------------|----------|
| All caption methods fail | No captions available | Use `fallbackToAudio: true` |
| Whisper fails with 401 | Invalid API key | Check `OPENAI_API_KEY` |
| Audio download fails | YouTube restrictions | Set `YTDL_COOKIE` |
| Random failures | Network issues | Implement retry logic |

### Error Recovery Strategies

1. **Automatic Retry with Backoff**
   ```javascript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
       }
     }
   }
   ```

2. **Graceful Degradation**
   ```javascript
   // Try high-quality first, fallback to basic
   const options = [
     { format: 'json', fallbackToAudio: true },
     { format: 'txt', fallbackToAudio: false },
     { format: 'txt', fallbackToAudio: true }
   ];
   ```

3. **Error Monitoring**
   ```javascript
   function logError(error, context) {
     console.error(`[${error.code}] ${error.message}`, {
       context,
       timestamp: new Date().toISOString(),
       hint: error.hint
     });
   }
   ```

## HTTP Status Code Summary

| Status | Error Codes | Description |
|--------|-------------|-------------|
| 400 | `INVALID_URL`, `INVALID_VIDEO_ID`, `MISSING_PARAMETERS` | Client request errors |
| 403 | `VIDEO_PRIVATE` | Access forbidden |
| 404 | `VIDEO_NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED` | Rate limiting |
| 451 | `VIDEO_RESTRICTED` | Legal restrictions |
| 502 | `NO_CAPTIONS_AVAILABLE`, `AUDIO_DOWNLOAD_FAILED`, `WHISPER_API_ERROR`, `ALL_METHODS_FAILED` | External service errors |
| 500 | Generic errors | Internal server errors |