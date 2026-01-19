# lighterceptor

Capture the outbound requests an HTML/JS/CSS payload would trigger in a
jsdom environment, without hitting the network.

## Install

```bash
pnpm add lighterceptor
```

## Quick Start

```ts
import { Lighterceptor } from "lighterceptor";

const html = `
  <!doctype html>
  <html>
    <head>
      <link rel="stylesheet" href="https://cdn.example.com/site.css" />
    </head>
    <body>
      <img src="https://cdn.example.com/logo.png" />
      <script>
        fetch("https://api.example.com/search?q=lighterceptor");
      </script>
    </body>
  </html>
`;

const result = await new Lighterceptor(html).run();
console.log(result.requests);
```

## Recursion (Dependency Graph)

Enable recursion to keep walking JS/CSS/HTML dependencies. This is useful
when HTML loads CSS/JS, and those assets load more assets.

```ts
import { Lighterceptor } from "lighterceptor";

const html = `
  <!doctype html>
  <link rel="stylesheet" href="https://example.com/site.css" />
  <script src="https://example.com/app.js"></script>
`;

const result = await new Lighterceptor(html, { recursion: true }).run();
console.log(result.requests.map((item) => item.url));
```

Recursion uses the global `fetch` to load discovered resources. In tests or
offline usage, stub `fetch` to return deterministic content.

## API

### Lighterceptor

```ts
type LighterceptorOptions = {
  settleTimeMs?: number;
  recursion?: boolean;
};

type RequestRecord = {
  url: string;
  source: "resource" | "img" | "css" | "fetch" | "xhr" | "unknown";
  timestamp: number;
};

type LighterceptorResult = {
  title?: string;
  capturedAt: string;
  requests: RequestRecord[];
};
```

- `settleTimeMs`: wait time before the run finishes, so script-driven requests
  can be captured.
- `recursion`: when true, fetches JS/CSS/HTML resources and applies the same
  interception logic to their dependencies.

### createJSDOMWithInterceptor

Use this when you need low-level access to jsdom.

```ts
import { createJSDOMWithInterceptor } from "lighterceptor";

const dom = createJSDOMWithInterceptor({
  html: "<img src='https://example.com/logo.png'>",
  domOptions: {
    pretendToBeVisual: true,
    runScripts: "dangerously",
  },
  interceptor: (url, options) => {
    console.log("Intercepted", url, options.source);
    return "";
  },
});
```

## Examples

See the `examples/` directory for more:

- `examples/basic-lighterceptor.ts`
- `examples/custom-interceptor.ts`
- `examples/aggregate-requests.ts`
- `examples/recursive-crawl.ts`
