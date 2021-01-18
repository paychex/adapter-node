import https from 'https';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import filter from 'lodash/filter.js';
import flatten from 'lodash/flatten.js';
import isEmpty from 'lodash/isEmpty.js';
import isString from 'lodash/isString.js';
import merge from 'lodash/merge.js';
import attempt from 'lodash/attempt.js';

const XSSI = /^\)]\}',?\n/;
const SUCCESS = /^2\d\d$/;

function safeParseJSON(response) {
    const json = String(response.data);
    response.data = JSON.parse(json.replace(XSSI, ''));
}

function setCached(response, sendDate) {
    const date = new Date(get(response, 'meta.headers.date'));
    if (!isNaN(date)) { // determines if Date is valid
        // Date header is only accurate to the nearest second
        // so we round both down to the second before comparing
        const responseTime = Math.floor(date.getTime() / 1000);
        const requestTime = Math.floor(sendDate.getTime() / 1000);
        set(response, 'meta.cached', responseTime < requestTime);
    }
}

function setErrorFromStatus(response) {
    const hasError = get(response, 'meta.error', false);
    const isFailure = !SUCCESS.test(get(response, 'status', 0));
    set(response, 'meta.error', hasError || isFailure);
}

function toStringArray(value) {
    return filter(flatten([value]), isString).join(', ');
}

function toKeyValuePair(name) {
    return [name, toStringArray(this[name])];
}

function hasHeaderValue([, values]) {
    return !isEmpty(values);
}

function setHeaderValue(result, [name, value]) {
    result[name] = value;
    return result;
}

function transformHeaders(headers) {
    return Object.keys(headers)
        .map(toKeyValuePair, headers)
        .filter(hasHeaderValue)
        .reduce(setHeaderValue, Object.create(null));
}

async function parseData(type, response) {
    switch (String(type).toLowerCase()) {
        case '':
        case 'json':
            attempt(safeParseJSON, response);
            break;
        case 'arraybuffer':
            response.data = new Uint8Array(response.data.split(' '));
            break;
        case 'blob':
            response.data = null;
            response.meta.error = true;
            response.statusText = 'Type `Blob` does not exist in NodeJS.';
            break;
        case 'document':
            const parser = new DOMParser();
            const responseType = get(response, 'meta.headers.content-type', 'text/html');
            response.data = parser.parseFromString(response.data, responseType);
            break;
    }
}

/**
 * @module index
 */

/**
 * A data adapter that uses the NodeJS built-in [https](https://nodejs.org/api/https.html) library to convert a Request into a Response. Can be passed to the [@paychex/core](https://github.com/paychex/core) createDataLayer factory method to enable data operations on NodeJS.
 *
 * @static
 * @function node
 * @param {Request} request The Request to convert into a Response.
 * @example
 * import nodeAdapter from '@paychex/adapter-node/index.js';
 * import { createDataLayer, createProxy } from '@paychex/core/data/index.js';
 *
 * const proxy = createProxy();
 * const { createRequest, fetch, setAdapter } = createDataLayer(proxy, nodeAdapter);
 */
export default function node(request) {

    const response = {
        meta: {
            headers: {},
            messages: [],
            error: false,
            cached: false,
            timeout: false,
        },
        data: null,
        status: 0,
        statusText: 'Unknown',
    };

    return new Promise(function RequestPromise(resolve) {
        let data = '';
        const sendDate = new Date();
        const url = new URL(request.url);
        const options = {
            method: request.method,
            timeout: request.timeout || 2147483647,
            headers: transformHeaders(request.headers),
        };
        const req = https.request(url, options, function callback(res) {
            merge(response.meta.headers, res.headers);
            setCached(response, sendDate);
            response.status = res.statusCode;
            response.statusText = res.statusMessage;
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', async () => {
                response.data = data;
                await parseData(request.responseType, response);
                setErrorFromStatus(response);
                resolve(response);
            });
        });
        req.on('error', (e) => {
            response.meta.error = true;
            response.meta.messages = [{
                code: e.message,
                data: []
            }];
        });
        req.on('timeout', () => {
            response.meta.error = true;
            response.meta.timeout = true;
        });
        req.on('abort', () => {
            response.meta.error = true;
        });
        if (request.body != null)
            req.write(JSON.stringify(request.body));
        req.end();
    });

}