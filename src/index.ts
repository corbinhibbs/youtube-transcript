import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

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

// New interface to support proxy URL strings
export interface ProxyUrlConfig {
  url: string; // e.g., 'http://username:password@host:port'
}

export interface TranscriptConfig {
  lang?: string;
  proxy?: ProxyConfig | ProxyUrlConfig | string; // Support multiple proxy formats
}
export interface TranscriptResponse {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
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
    let proxyUrl: string;
    
    if (typeof config.proxy === 'string') {
      // Direct proxy URL string
      proxyUrl = config.proxy;
    } else if ('url' in config.proxy) {
      // ProxyUrlConfig format
      proxyUrl = config.proxy.url;
    } else {
      // Legacy ProxyConfig format - convert to URL
      const { host, port, auth, protocol = 'http' } = config.proxy;
      const authString = auth ? `${auth.username}:${auth.password}@` : '';
      proxyUrl = `${protocol}://${authString}${host}:${port}`;
    }
    
    // Use HttpsProxyAgent for HTTPS requests
    if (isHttps) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
    } else {
      // For HTTP requests, still use HttpsProxyAgent as it handles both
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
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
    
    const axiosConfig = createAxiosConfig(config, true);
    console.log('fetchTranscriptWithHtmlScraping3', axiosConfig);
    
    try {
      const videoPageResponse = await axios.get<string>(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
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
      console.log('fetchTranscriptWithHtmlScraping failed:', error.message);
      throw error;
    }
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
    
    const axiosConfig = createAxiosConfig(config, true);
    axiosConfig.headers['Content-Type'] = 'application/json';
    axiosConfig.headers['Origin'] = 'https://www.youtube.com';
    axiosConfig.headers['Referer'] = `https://www.youtube.com/watch?v=${identifier}`;
    console.log('fetchTranscriptWithInnerTube', axiosConfig);
    
    try {
      const InnerTubeApiResponse = await axios.post<any>('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
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
      console.log('fetchTranscriptWithInnerTube failed:', error.message);
      throw error;
    }
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

    const axiosConfig = createAxiosConfig(config, transcriptURL.startsWith('https:'));
    console.log('processTranscriptFromCaptions', axiosConfig);
    
    try {
      const transcriptResponse = await axios.get<string>(transcriptURL, axiosConfig);
      const transcriptBody: string = transcriptResponse.data;
      const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
      return results.map((result) => ({
        text: result[3],
        duration: parseFloat(result[2]),
        offset: parseFloat(result[1]),
        lang: config?.lang ?? captions.captionTracks[0].languageCode,
      }));
    } catch (error) {
      console.log('processTranscriptFromCaptions failed:', error.message);
      throw error;
    }
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
