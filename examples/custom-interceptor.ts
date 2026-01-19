import { createJSDOMWithInterceptor } from "../src/index";

type CapturedRequest = {
  url: string;
  source: string;
};

const captured: CapturedRequest[] = [];

const dom = createJSDOMWithInterceptor({
  html: `
    <!doctype html>
    <html>
      <head>
        <link rel="stylesheet" href="https://assets.example.com/theme.css" />
      </head>
      <body>
        <p>Custom interceptor demo</p>
      </body>
    </html>
  `,
  domOptions: {
    pretendToBeVisual: true,
    runScripts: "dangerously",
    beforeParse(window) {
      // Provide safe stubs so fetch/XHR don't touch the network during examples.
      window.fetch = () =>
        Promise.resolve({ ok: true }) as unknown as Promise<Response>;
      window.XMLHttpRequest.prototype.send = function send() {};
    },
  },
  interceptor: (url, options) => {
    captured.push({
      url,
      source: options.source ?? "unknown",
    });

    // Pretend we already have the stylesheet and return it immediately.
    if (url.endsWith("/theme.css")) {
      return `
        body {
          background-image: url("https://assets.example.com/paper.png");
        }
      `;
    }

    // Returning an empty string skips any network fetch for other assets.
    return "";
  },
});

async function run() {
  const { document } = dom.window;

  // This image will be intercepted when its src is assigned.
  const badge = document.createElement("img");
  badge.setAttribute("src", "https://assets.example.com/badge.png");
  document.body.appendChild(badge);

  // Setting a style property with a url() also triggers interception.
  document.body.style.setProperty(
    "background-image",
    "url(https://assets.example.com/texture.png)",
  );

  // Explicit fetch and XHR calls are still captured by the interceptor.
  await dom.window.fetch("https://api.example.com/custom");
  const xhr = new dom.window.XMLHttpRequest();
  xhr.open("GET", "https://api.example.com/xhr");
  xhr.send();

  console.log("Captured requests:", captured);
}

void run();
