# @paychex/adapter-node

A data adapter that uses the NodeJS built-in [https](https://nodejs.org/api/https.html) library to convert a Request into a Response. Can be passed to the [@paychex/core](https://github.com/paychex/core) createDataLayer factory method to enable data operations on NodeJS.

## Installation

```bash
npm install @paychex/adapter-node
```

## Importing

### esm

```js
import { node } from '@paychex/adapter-node';
```

### cjs

```js
const { node } = require('@paychex/adapter-node');
```

## Usage

```js
import { data } from '@paychex/core';
import { node } from '@paychex/adapter-node';

const proxy = data.createProxy();
const { createRequest, fetch, setAdapter } = data.createDataLayer(proxy, node);
```
