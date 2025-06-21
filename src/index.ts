import axios from 'axios';

const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

export class YoutubeTranscriptError extends Error {
  constructor(message) {
    super(`[YoutubeTranscript] 🚨 ${message}`);
  }
}

export class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
  constructor() {
    super(
      'YouTube is receiving too many requests from this IP and now requires solving a captcha to continue'
    );
  }
}

export class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`The video is no longer available (${videoId})`);
  }
}

export class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`Transcript is disabled on this video (${videoId})`);
  }
}

export class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`No transcripts are available for this video (${videoId})`);
  }
}

export class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
  constructor(lang: string, availableLangs: string[], videoId: string) {
    super(
      `No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(
        ', '
      )}`
    );
  }
}

export class YoutubeTranscriptEmptyError extends YoutubeTranscriptError {
  constructor(videoId: string, method: string) {
    super(`The transcript file URL returns an empty response using ${method} (${videoId})`);
  }
}

export interface ProxyConfig {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  protocol?: 'http' | 'https';
}

export interface TranscriptConfig {
  lang?: string;
  proxy?: ProxyConfig;
}
export interface TranscriptResponse {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

interface AxiosProxyConfig {
  protocol: string;
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * Convert ProxyConfig to Axios proxy format
 */
function createAxiosProxyConfig(proxyConfig: ProxyConfig): AxiosProxyConfig {
  // For HTTPS requests through proxies, we typically use HTTP CONNECT tunneling
  // This means the proxy connection itself is usually HTTP, even for HTTPS target URLs
  return {
    protocol: 'http', // Force HTTP for proxy connection - this is standard for most proxies
    host: proxyConfig.host,
    port: proxyConfig.port,
    auth: proxyConfig.auth ? {
      username: proxyConfig.auth.username,
      password: proxyConfig.auth.password,
    } : undefined,
  };
}

/**
 * Create axios configuration with proper proxy and SSL handling
 */
function createAxiosConfig(config?: TranscriptConfig, isHttps: boolean = true) {
  const axiosConfig: any = {
    headers: {
      ...(config?.lang && { 'Accept-Language': config.lang }),
      'User-Agent': USER_AGENT,
    },
    timeout: 30000, // 30 second timeout
  };

  if (config?.proxy) {
    axiosConfig.proxy = createAxiosProxyConfig(config.proxy);
    
    // For HTTPS requests through proxies, configure the HTTPS agent properly
    if (isHttps) {
      axiosConfig.httpsAgent = new (require('https').Agent)({
        rejectUnauthorized: false, // May be needed for some proxy setups
        keepAlive: true,
      });
      
      // Disable HTTP agent for HTTPS requests to avoid conflicts
      axiosConfig.httpAgent = false;
    }
  }

  return axiosConfig;
}

/**
 * Class to retrieve transcript if exist
 */
export class YoutubeTranscript {
  /**
   * Fetch transcript from YTB Video
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  public static async fetchTranscript(
    videoId: string,
    config?: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    try {
      console.log('fetchTranscriptWithHtmlScraping1', videoId, config);
      return await this.fetchTranscriptWithHtmlScraping(videoId, config);
    } catch (e) {
      if (e instanceof YoutubeTranscriptEmptyError) {
        console.log('fetchTranscriptWithInnerTube', videoId, config);
        return await this.fetchTranscriptWithInnerTube(videoId, config);
      } else { 
        console.log('fetchTranscriptWithHtmlScraping Throwing error', e);
        throw e;
      }
    }
  }

  /**
   * Fetch transcript from YTB Video using HTML scraping
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  private static async fetchTranscriptWithHtmlScraping(videoId: string, config?: TranscriptConfig) {
    const identifier = this.retrieveVideoId(videoId);
    console.log('fetchTranscriptWithHtmlScraping2', identifier, config);
    
    // Try different proxy configurations if proxy fails
    const attempts = [];
    
    if (config?.proxy) {
      // Attempt 1: Standard HTTP proxy with CONNECT tunneling
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, true);
        console.log('fetchTranscriptWithHtmlScraping3 - Attempt 1 (HTTP proxy)', axiosConfig);
        return axios.get<string>(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
      });
      
      // Attempt 2: Try without custom HTTPS agent
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, true);
        delete axiosConfig.httpsAgent;
        delete axiosConfig.httpAgent;
        console.log('fetchTranscriptWithHtmlScraping3 - Attempt 2 (simplified proxy)', axiosConfig);
        return axios.get<string>(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
      });
      
      // Attempt 3: Try without proxy
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(undefined, true);
        console.log('fetchTranscriptWithHtmlScraping3 - Attempt 3 (no proxy)', axiosConfig);
        return axios.get<string>(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
      });
    } else {
      // No proxy configured, direct request
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, true);
        console.log('fetchTranscriptWithHtmlScraping3 - Direct request', axiosConfig);
        return axios.get<string>(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
      });
    }
    
    let lastError: any;
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        const videoPageResponse = await attempts[i]();
        const videoPageBody: string = videoPageResponse.data;

        console.log('videoPageBody', videoPageBody);
        const splittedHTML = videoPageBody.split('"captions":');

        if (splittedHTML.length <= 1) {
          if (videoPageBody.includes('class="g-recaptcha"')) {
            throw new YoutubeTranscriptTooManyRequestError();
          }
          if (!videoPageBody.includes('"playabilityStatus":')) {
            throw new YoutubeTranscriptVideoUnavailableError(videoId);
          }
          throw new YoutubeTranscriptDisabledError(videoId);
        }

        const captions = (() => {
          try {
            return JSON.parse(
              splittedHTML[1].split(',"videoDetails')[0].replace('\n', '')
            );
          } catch (e) {
            return undefined;
          }
        })()?.['playerCaptionsTracklistRenderer'];

        const processedTranscript = await this.processTranscriptFromCaptions(
          captions,
          videoId,
          config
        );

        if (!processedTranscript.length) {
          throw new YoutubeTranscriptEmptyError(videoId, 'HTML scraping');
        }

        return processedTranscript;
      } catch (error) {
        lastError = error;
        console.log(`fetchTranscriptWithHtmlScraping - Attempt ${i + 1} failed:`, error.message);
        
        // If it's not a proxy/SSL error, don't retry
        if (!(error.code === 'EPROTO' || error.message?.includes('SSL') || error.message?.includes('TLS') || error.message?.includes('proxy'))) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (i === attempts.length - 1) {
          if (error.code === 'EPROTO' || error.message?.includes('SSL') || error.message?.includes('TLS')) {
            throw new YoutubeTranscriptError(
              `All proxy connection attempts failed. Last error: ${error.message}. ` +
              `Try: 1) Check proxy configuration, 2) Use HTTP instead of HTTPS for proxy protocol, 3) Disable proxy temporarily.`
            );
          }
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Fetch transcript from YTB Video using InnerTube API
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  private static async fetchTranscriptWithInnerTube(
    videoId: string,
    config?: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    const identifier = this.retrieveVideoId(videoId);
    
    // Try different proxy configurations if proxy fails
    const attempts = [];
    
    const requestBody = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20250312.04.00',
          userAgent: USER_AGENT
        }
      },
      videoId: identifier,
    };
    
    if (config?.proxy) {
      // Attempt 1: Standard HTTP proxy with CONNECT tunneling
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, true);
        axiosConfig.headers['Content-Type'] = 'application/json';
        axiosConfig.headers['Origin'] = 'https://www.youtube.com';
        axiosConfig.headers['Referer'] = `https://www.youtube.com/watch?v=${identifier}`;
        console.log('fetchTranscriptWithInnerTube - Attempt 1 (HTTP proxy)', axiosConfig);
        return axios.post<any>('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
      });
      
      // Attempt 2: Try without custom HTTPS agent
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, true);
        delete axiosConfig.httpsAgent;
        delete axiosConfig.httpAgent;
        axiosConfig.headers['Content-Type'] = 'application/json';
        axiosConfig.headers['Origin'] = 'https://www.youtube.com';
        axiosConfig.headers['Referer'] = `https://www.youtube.com/watch?v=${identifier}`;
        console.log('fetchTranscriptWithInnerTube - Attempt 2 (simplified proxy)', axiosConfig);
        return axios.post<any>('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
      });
      
      // Attempt 3: Try without proxy
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(undefined, true);
        axiosConfig.headers['Content-Type'] = 'application/json';
        axiosConfig.headers['Origin'] = 'https://www.youtube.com';
        axiosConfig.headers['Referer'] = `https://www.youtube.com/watch?v=${identifier}`;
        console.log('fetchTranscriptWithInnerTube - Attempt 3 (no proxy)', axiosConfig);
        return axios.post<any>('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
      });
    } else {
      // No proxy configured, direct request
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, true);
        axiosConfig.headers['Content-Type'] = 'application/json';
        axiosConfig.headers['Origin'] = 'https://www.youtube.com';
        axiosConfig.headers['Referer'] = `https://www.youtube.com/watch?v=${identifier}`;
        console.log('fetchTranscriptWithInnerTube - Direct request', axiosConfig);
        return axios.post<any>('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
      });
    }
    
    let lastError: any;
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        const InnerTubeApiResponse = await attempts[i]();
        const { captions: { playerCaptionsTracklistRenderer: captions } } = InnerTubeApiResponse.data;

        const processedTranscript = await this.processTranscriptFromCaptions(
          captions,
          videoId,
          config
        );

        if (!processedTranscript.length) {
          throw new YoutubeTranscriptEmptyError(videoId, 'InnerTube API');
        }

        return processedTranscript;
      } catch (error) {
        lastError = error;
        console.log(`fetchTranscriptWithInnerTube - Attempt ${i + 1} failed:`, error.message);
        
        // If it's not a proxy/SSL error, don't retry
        if (!(error.code === 'EPROTO' || error.message?.includes('SSL') || error.message?.includes('TLS') || error.message?.includes('proxy'))) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (i === attempts.length - 1) {
          if (error.code === 'EPROTO' || error.message?.includes('SSL') || error.message?.includes('TLS')) {
            throw new YoutubeTranscriptError(
              `All proxy connection attempts failed in InnerTube API. Last error: ${error.message}. ` +
              `Try: 1) Check proxy configuration, 2) Use HTTP instead of HTTPS for proxy protocol, 3) Disable proxy temporarily.`
            );
          }
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Process transcript from data captions
   * @param captions Data captions
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  private static async processTranscriptFromCaptions(
    captions: any,
    videoId: string,
    config?: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    if (!captions) {
      throw new YoutubeTranscriptDisabledError(videoId);
    }

    if (!('captionTracks' in captions)) {
      throw new YoutubeTranscriptNotAvailableError(videoId);
    }

    if (
      config?.lang &&
      !captions.captionTracks.some(
        (track) => track.languageCode === config?.lang
      )
    ) {
      throw new YoutubeTranscriptNotAvailableLanguageError(
        config?.lang,
        captions.captionTracks.map((track) => track.languageCode),
        videoId
      );
    }

    const transcriptURL = (
      config?.lang
        ? captions.captionTracks.find(
            (track) => track.languageCode === config?.lang
          )
        : captions.captionTracks[0]
    ).baseUrl;

    // Try different proxy configurations if proxy fails
    const attempts = [];
    
    if (config?.proxy) {
      // Attempt 1: Standard HTTP proxy with CONNECT tunneling
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, transcriptURL.startsWith('https:'));
        console.log('processTranscriptFromCaptions - Attempt 1 (HTTP proxy)', axiosConfig);
        return axios.get<string>(transcriptURL, axiosConfig);
      });
      
      // Attempt 2: Try without custom HTTPS agent
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, transcriptURL.startsWith('https:'));
        delete axiosConfig.httpsAgent;
        delete axiosConfig.httpAgent;
        console.log('processTranscriptFromCaptions - Attempt 2 (simplified proxy)', axiosConfig);
        return axios.get<string>(transcriptURL, axiosConfig);
      });
      
      // Attempt 3: Try without proxy
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(undefined, transcriptURL.startsWith('https:'));
        console.log('processTranscriptFromCaptions - Attempt 3 (no proxy)', axiosConfig);
        return axios.get<string>(transcriptURL, axiosConfig);
      });
    } else {
      // No proxy configured, direct request
      attempts.push(() => {
        const axiosConfig = createAxiosConfig(config, transcriptURL.startsWith('https:'));
        console.log('processTranscriptFromCaptions - Direct request', axiosConfig);
        return axios.get<string>(transcriptURL, axiosConfig);
      });
    }
    
    let lastError: any;
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        const transcriptResponse = await attempts[i]();
        const transcriptBody: string = transcriptResponse.data;
        const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
        return results.map((result) => ({
          text: result[3],
          duration: parseFloat(result[2]),
          offset: parseFloat(result[1]),
          lang: config?.lang ?? captions.captionTracks[0].languageCode,
        }));
      } catch (error) {
        lastError = error;
        console.log(`processTranscriptFromCaptions - Attempt ${i + 1} failed:`, error.message);
        
        // If it's not a proxy/SSL error, don't retry
        if (!(error.code === 'EPROTO' || error.message?.includes('SSL') || error.message?.includes('TLS') || error.message?.includes('proxy'))) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (i === attempts.length - 1) {
          if (error.code === 'EPROTO' || error.message?.includes('SSL') || error.message?.includes('TLS')) {
            throw new YoutubeTranscriptError(
              `All proxy connection attempts failed when fetching transcript. Last error: ${error.message}. ` +
              `Try: 1) Check proxy configuration, 2) Use HTTP instead of HTTPS for proxy protocol, 3) Disable proxy temporarily.`
            );
          }
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Retrieve video id from url or string
   * @param videoId video url or video id
   */
  private static retrieveVideoId(videoId: string) {
    if (videoId.length === 11) {
      return videoId;
    }
    const matchId = videoId.match(RE_YOUTUBE);
    if (matchId && matchId.length) {
      return matchId[1];
    }
    throw new YoutubeTranscriptError(
      'Impossible to retrieve Youtube video ID.'
    );
  }
}
