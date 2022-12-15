/**
 * ### esm
 *
 * ```js
 * import { node } from '@paychex/adapter-node';
 * ```
 *
 * ### cjs
 *
 * ```js
 * const { node } = require('@paychex/adapter-node');
 * ```
 *
 * @module main
 */

import * as https from 'https';

import {
    get,
    set,
    filter,
    flatten,
    isEmpty,
    isString,
    merge,
    attempt,
} from 'lodash';

import type { HeadersMap, Request, Response } from '@paychex/core/types/data';
export type { Request, Response };

type Header = Record<string, string>;

const XSSI = /^\)]\}',?\n/;
const SUCCESS = /^2\d\d$/;

function safeParseJSON(response: Response): void {
    const json = String(response.data);
    response.data = JSON.parse(json.replace(XSSI, ''));
}

function setCached(response: Response, sendDate: Date): void {
    const date = new Date(get(response, 'meta.headers.date') as string);
    if (!isNaN(Number(date))) { // determines if Date is valid
        // Date header is only accurate to the nearest second
        // so we round both down to the second before comparing
        const responseTime = Math.floor(date.getTime() / 1000);
        const requestTime = Math.floor(sendDate.getTime() / 1000);
        set(response, 'meta.cached', responseTime < requestTime);
    }
}

function setErrorFromStatus(response: Response): void {
    const hasError = get(response, 'meta.error', false);
    const isFailure = !SUCCESS.test(String(get(response, 'status', 0)));
    set(response, 'meta.error', hasError || isFailure);
}

function toStringArray(value: string | string[]): string {
    return filter(flatten([value]), isString).join(', ');
}

function toKeyValuePair(name: string): [string, string] {
    return [name, toStringArray(this[name])];
}

function hasHeaderValue([, values]: [any, string]): boolean {
    return !isEmpty(values);
}

function setHeaderValue(result: Header, [name, value]: [string, string]): Header {
    result[name] = value;
    return result;
}

function transformHeaders(headers: HeadersMap): Header {
    return Object.keys(headers)
        .map(toKeyValuePair, headers)
        .filter(hasHeaderValue)
        .reduce(setHeaderValue, Object.create(null));
}

async function parseData(type: XMLHttpRequestResponseType, response: Response) {
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
 * A data adapter that uses the NodeJS built-in [https](https://nodejs.org/api/https.html) library to convert a Request into a Response. Can be passed to the [@paychex/core](https://github.com/paychex/core) createDataLayer factory method to enable data operations on NodeJS.
 *
 * @param request The Request to convert into a Response.
 * @returns A Promise resolved with the Response.
 * @example
 * ```js
 * const proxy = data.createProxy();
 * const { createRequest, fetch, setAdapter } = data.createDataLayer(proxy, node);
 * ```
 */
export function node(request: Request): Promise<Response> {

    const response: Response = {
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
        let body = '';
        const sendDate = new Date();
        const options: https.RequestOptions = {
            method: request.method,
            timeout: request.timeout || 2147483647,
            headers: transformHeaders(request.headers),
        };
        const req = https.request(request.url, options, function callback(res) {
            merge(response.meta.headers, res.headers);
            setCached(response, sendDate);
            response.status = res.statusCode;
            response.statusText = res.statusMessage;
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', async () => {
                response.data = body;
                await parseData(request.responseType, response);
                setErrorFromStatus(response);
                resolve(response);
            });
        });
        req.on('error', (e) => {
            response.meta.error = true;
            response.meta.messages = [{
                data: [],
                code: e.message,
                severity: 'ERROR',
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