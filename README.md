# @paychex/adapter-node

A data adapter that uses the NodeJS built-in [https](https://nodejs.org/api/https.html) library to convert a Request into a Response. Can be passed to the [@paychex/core](https://github.com/paychex/core) createDataLayer factory method to enable data operations on NodeJS.

## Installation

```bash
npm install @paychex/adapter-node
```

## Usage

```js
import nodeAdapter from '@paychex/adapter-node/index.js';
import { createDataLayer, createProxy } from '@paychex/core/data/index.js';

const proxy = createProxy();
const { createRequest, fetch, setAdapter } = createDataLayer(proxy, nodeAdapter);
```
