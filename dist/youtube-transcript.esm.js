import axios from 'axios';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

const RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
class YoutubeTranscriptError extends Error {
    constructor(message) {
        super(`[YoutubeTranscript] 🚨 ${message}`);
    }
}
class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
    constructor() {
        super('YouTube is receiving too many requests from this IP and now requires solving a captcha to continue');
    }
}
class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`The video is no longer available (${videoId})`);
    }
}
class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`Transcript is disabled on this video (${videoId})`);
    }
}
class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`No transcripts are available for this video (${videoId})`);
    }
}
class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
    constructor(lang, availableLangs, videoId) {
        super(`No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(', ')}`);
    }
}
class YoutubeTranscriptEmptyError extends YoutubeTranscriptError {
    constructor(videoId, method) {
        super(`The transcript file URL returns an empty response using ${method} (${videoId})`);
    }
}
/**
 * Convert ProxyConfig to Axios proxy format
 */
function createAxiosProxyConfig(proxyConfig) {
    // For HTTPS requests through proxies, we typically use HTTP CONNECT tunneling
    // This means the proxy connection itself is usually HTTP, even for HTTPS target URLs
    return {
        protocol: 'http',
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
function createAxiosConfig(config, isHttps = true) {
    const axiosConfig = {
        headers: Object.assign(Object.assign({}, ((config === null || config === void 0 ? void 0 : config.lang) && { 'Accept-Language': config.lang })), { 'User-Agent': USER_AGENT }),
        timeout: 30000,
    };
    if (config === null || config === void 0 ? void 0 : config.proxy) {
        axiosConfig.proxy = createAxiosProxyConfig(config.proxy);
        // For HTTPS requests through proxies, configure the HTTPS agent properly
        if (isHttps) {
            axiosConfig.httpsAgent = new (require('https').Agent)({
                rejectUnauthorized: false,
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
class YoutubeTranscript {
    /**
     * Fetch transcript from YTB Video
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static fetchTranscript(videoId, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('fetchTranscriptWithHtmlScraping1', videoId, config);
                return yield this.fetchTranscriptWithHtmlScraping(videoId, config);
            }
            catch (e) {
                if (e instanceof YoutubeTranscriptEmptyError) {
                    console.log('fetchTranscriptWithInnerTube', videoId, config);
                    return yield this.fetchTranscriptWithInnerTube(videoId, config);
                }
                else {
                    console.log('fetchTranscriptWithHtmlScraping Throwing error', e);
                    throw e;
                }
            }
        });
    }
    /**
     * Fetch transcript from YTB Video using HTML scraping
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static fetchTranscriptWithHtmlScraping(videoId, config) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            const identifier = this.retrieveVideoId(videoId);
            console.log('fetchTranscriptWithHtmlScraping2', identifier, config);
            // Try different proxy configurations if proxy fails
            const attempts = [];
            if (config === null || config === void 0 ? void 0 : config.proxy) {
                // Attempt 1: Standard HTTP proxy with CONNECT tunneling
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(config, true);
                    console.log('fetchTranscriptWithHtmlScraping3 - Attempt 1 (HTTP proxy)', axiosConfig);
                    return axios.get(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
                });
                // Attempt 2: Try without custom HTTPS agent
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(config, true);
                    delete axiosConfig.httpsAgent;
                    delete axiosConfig.httpAgent;
                    console.log('fetchTranscriptWithHtmlScraping3 - Attempt 2 (simplified proxy)', axiosConfig);
                    return axios.get(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
                });
                // Attempt 3: Try without proxy
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(undefined, true);
                    console.log('fetchTranscriptWithHtmlScraping3 - Attempt 3 (no proxy)', axiosConfig);
                    return axios.get(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
                });
            }
            else {
                // No proxy configured, direct request
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(config, true);
                    console.log('fetchTranscriptWithHtmlScraping3 - Direct request', axiosConfig);
                    return axios.get(`https://www.youtube.com/watch?v=${identifier}`, axiosConfig);
                });
            }
            let lastError;
            for (let i = 0; i < attempts.length; i++) {
                try {
                    const videoPageResponse = yield attempts[i]();
                    const videoPageBody = videoPageResponse.data;
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
                    const captions = (_a = (() => {
                        try {
                            return JSON.parse(splittedHTML[1].split(',"videoDetails')[0].replace('\n', ''));
                        }
                        catch (e) {
                            return undefined;
                        }
                    })()) === null || _a === void 0 ? void 0 : _a['playerCaptionsTracklistRenderer'];
                    const processedTranscript = yield this.processTranscriptFromCaptions(captions, videoId, config);
                    if (!processedTranscript.length) {
                        throw new YoutubeTranscriptEmptyError(videoId, 'HTML scraping');
                    }
                    return processedTranscript;
                }
                catch (error) {
                    lastError = error;
                    console.log(`fetchTranscriptWithHtmlScraping - Attempt ${i + 1} failed:`, error.message);
                    // If it's not a proxy/SSL error, don't retry
                    if (!(error.code === 'EPROTO' || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('SSL')) || ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('TLS')) || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('proxy')))) {
                        throw error;
                    }
                    // If this was the last attempt, throw the error
                    if (i === attempts.length - 1) {
                        if (error.code === 'EPROTO' || ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('SSL')) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('TLS'))) {
                            throw new YoutubeTranscriptError(`All proxy connection attempts failed. Last error: ${error.message}. ` +
                                `Try: 1) Check proxy configuration, 2) Use HTTP instead of HTTPS for proxy protocol, 3) Disable proxy temporarily.`);
                        }
                        throw error;
                    }
                }
            }
            throw lastError;
        });
    }
    /**
     * Fetch transcript from YTB Video using InnerTube API
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static fetchTranscriptWithInnerTube(videoId, config) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
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
            if (config === null || config === void 0 ? void 0 : config.proxy) {
                // Attempt 1: Standard HTTP proxy with CONNECT tunneling
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(config, true);
                    axiosConfig.headers['Content-Type'] = 'application/json';
                    axiosConfig.headers['Origin'] = 'https://www.youtube.com';
                    axiosConfig.headers['Referer'] = `https://www.youtube.com/watch?v=${identifier}`;
                    console.log('fetchTranscriptWithInnerTube - Attempt 1 (HTTP proxy)', axiosConfig);
                    return axios.post('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
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
                    return axios.post('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
                });
                // Attempt 3: Try without proxy
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(undefined, true);
                    axiosConfig.headers['Content-Type'] = 'application/json';
                    axiosConfig.headers['Origin'] = 'https://www.youtube.com';
                    axiosConfig.headers['Referer'] = `https://www.youtube.com/watch?v=${identifier}`;
                    console.log('fetchTranscriptWithInnerTube - Attempt 3 (no proxy)', axiosConfig);
                    return axios.post('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
                });
            }
            else {
                // No proxy configured, direct request
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(config, true);
                    axiosConfig.headers['Content-Type'] = 'application/json';
                    axiosConfig.headers['Origin'] = 'https://www.youtube.com';
                    axiosConfig.headers['Referer'] = `https://www.youtube.com/watch?v=${identifier}`;
                    console.log('fetchTranscriptWithInnerTube - Direct request', axiosConfig);
                    return axios.post('https://www.youtube.com/youtubei/v1/player', requestBody, axiosConfig);
                });
            }
            let lastError;
            for (let i = 0; i < attempts.length; i++) {
                try {
                    const InnerTubeApiResponse = yield attempts[i]();
                    const { captions: { playerCaptionsTracklistRenderer: captions } } = InnerTubeApiResponse.data;
                    const processedTranscript = yield this.processTranscriptFromCaptions(captions, videoId, config);
                    if (!processedTranscript.length) {
                        throw new YoutubeTranscriptEmptyError(videoId, 'InnerTube API');
                    }
                    return processedTranscript;
                }
                catch (error) {
                    lastError = error;
                    console.log(`fetchTranscriptWithInnerTube - Attempt ${i + 1} failed:`, error.message);
                    // If it's not a proxy/SSL error, don't retry
                    if (!(error.code === 'EPROTO' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('SSL')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('TLS')) || ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('proxy')))) {
                        throw error;
                    }
                    // If this was the last attempt, throw the error
                    if (i === attempts.length - 1) {
                        if (error.code === 'EPROTO' || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('SSL')) || ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('TLS'))) {
                            throw new YoutubeTranscriptError(`All proxy connection attempts failed in InnerTube API. Last error: ${error.message}. ` +
                                `Try: 1) Check proxy configuration, 2) Use HTTP instead of HTTPS for proxy protocol, 3) Disable proxy temporarily.`);
                        }
                        throw error;
                    }
                }
            }
            throw lastError;
        });
    }
    /**
     * Process transcript from data captions
     * @param captions Data captions
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static processTranscriptFromCaptions(captions, videoId, config) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            if (!captions) {
                throw new YoutubeTranscriptDisabledError(videoId);
            }
            if (!('captionTracks' in captions)) {
                throw new YoutubeTranscriptNotAvailableError(videoId);
            }
            if ((config === null || config === void 0 ? void 0 : config.lang) &&
                !captions.captionTracks.some((track) => track.languageCode === (config === null || config === void 0 ? void 0 : config.lang))) {
                throw new YoutubeTranscriptNotAvailableLanguageError(config === null || config === void 0 ? void 0 : config.lang, captions.captionTracks.map((track) => track.languageCode), videoId);
            }
            const transcriptURL = ((config === null || config === void 0 ? void 0 : config.lang) ? captions.captionTracks.find((track) => track.languageCode === (config === null || config === void 0 ? void 0 : config.lang))
                : captions.captionTracks[0]).baseUrl;
            // Try different proxy configurations if proxy fails
            const attempts = [];
            if (config === null || config === void 0 ? void 0 : config.proxy) {
                // Attempt 1: Standard HTTP proxy with CONNECT tunneling
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(config, transcriptURL.startsWith('https:'));
                    console.log('processTranscriptFromCaptions - Attempt 1 (HTTP proxy)', axiosConfig);
                    return axios.get(transcriptURL, axiosConfig);
                });
                // Attempt 2: Try without custom HTTPS agent
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(config, transcriptURL.startsWith('https:'));
                    delete axiosConfig.httpsAgent;
                    delete axiosConfig.httpAgent;
                    console.log('processTranscriptFromCaptions - Attempt 2 (simplified proxy)', axiosConfig);
                    return axios.get(transcriptURL, axiosConfig);
                });
                // Attempt 3: Try without proxy
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(undefined, transcriptURL.startsWith('https:'));
                    console.log('processTranscriptFromCaptions - Attempt 3 (no proxy)', axiosConfig);
                    return axios.get(transcriptURL, axiosConfig);
                });
            }
            else {
                // No proxy configured, direct request
                attempts.push(() => {
                    const axiosConfig = createAxiosConfig(config, transcriptURL.startsWith('https:'));
                    console.log('processTranscriptFromCaptions - Direct request', axiosConfig);
                    return axios.get(transcriptURL, axiosConfig);
                });
            }
            let lastError;
            for (let i = 0; i < attempts.length; i++) {
                try {
                    const transcriptResponse = yield attempts[i]();
                    const transcriptBody = transcriptResponse.data;
                    const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
                    return results.map((result) => {
                        var _a;
                        return ({
                            text: result[3],
                            duration: parseFloat(result[2]),
                            offset: parseFloat(result[1]),
                            lang: (_a = config === null || config === void 0 ? void 0 : config.lang) !== null && _a !== void 0 ? _a : captions.captionTracks[0].languageCode,
                        });
                    });
                }
                catch (error) {
                    lastError = error;
                    console.log(`processTranscriptFromCaptions - Attempt ${i + 1} failed:`, error.message);
                    // If it's not a proxy/SSL error, don't retry
                    if (!(error.code === 'EPROTO' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('SSL')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('TLS')) || ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('proxy')))) {
                        throw error;
                    }
                    // If this was the last attempt, throw the error
                    if (i === attempts.length - 1) {
                        if (error.code === 'EPROTO' || ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('SSL')) || ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('TLS'))) {
                            throw new YoutubeTranscriptError(`All proxy connection attempts failed when fetching transcript. Last error: ${error.message}. ` +
                                `Try: 1) Check proxy configuration, 2) Use HTTP instead of HTTPS for proxy protocol, 3) Disable proxy temporarily.`);
                        }
                        throw error;
                    }
                }
            }
            throw lastError;
        });
    }
    /**
     * Retrieve video id from url or string
     * @param videoId video url or video id
     */
    static retrieveVideoId(videoId) {
        if (videoId.length === 11) {
            return videoId;
        }
        const matchId = videoId.match(RE_YOUTUBE);
        if (matchId && matchId.length) {
            return matchId[1];
        }
        throw new YoutubeTranscriptError('Impossible to retrieve Youtube video ID.');
    }
}

export { YoutubeTranscript, YoutubeTranscriptDisabledError, YoutubeTranscriptEmptyError, YoutubeTranscriptError, YoutubeTranscriptNotAvailableError, YoutubeTranscriptNotAvailableLanguageError, YoutubeTranscriptTooManyRequestError, YoutubeTranscriptVideoUnavailableError };
