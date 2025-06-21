export declare class YoutubeTranscriptError extends Error {
    constructor(message: any);
}
export declare class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
    constructor();
}
export declare class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
    constructor(videoId: string);
}
export declare class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
    constructor(videoId: string);
}
export declare class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
    constructor(videoId: string);
}
export declare class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
    constructor(lang: string, availableLangs: string[], videoId: string);
}
export declare class YoutubeTranscriptEmptyError extends YoutubeTranscriptError {
    constructor(videoId: string, method: string);
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
/**
 * Class to retrieve transcript if exist
 */
export declare class YoutubeTranscript {
    /**
     * Fetch transcript from YTB Video
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static fetchTranscript(videoId: string, config?: TranscriptConfig): Promise<TranscriptResponse[]>;
    /**
     * Fetch transcript from YTB Video using HTML scraping
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    private static fetchTranscriptWithHtmlScraping;
    /**
     * Fetch transcript from YTB Video using InnerTube API
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    private static fetchTranscriptWithInnerTube;
    /**
     * Process transcript from data captions
     * @param captions Data captions
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    private static processTranscriptFromCaptions;
    /**
     * Retrieve video id from url or string
     * @param videoId video url or video id
     */
    private static retrieveVideoId;
}
