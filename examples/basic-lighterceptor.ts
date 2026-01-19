import { Lighterceptor } from "../src/index";

// This example uses the high-level Lighterceptor wrapper to scan HTML and
// capture any outbound requests it would have triggered in a browser.
const html = `
  <!doctype html>
  <html>
    <head>
      <title>Landing Page</title>
      <link rel="stylesheet" href="https://cdn.example.com/site.css" />
      <style>
        @import url("https://cdn.example.com/fonts.css");
        .hero {
          background-image: url("https://cdn.example.com/hero-bg.jpg");
        }
      </style>
    </head>
    <body>
      <img src="https://cdn.example.com/logo.png" />
      <script>
        // Script-driven URLs are captured too once scripts are allowed to run.
        fetch("https://api.example.com/search?q=lighterceptor");
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "https://api.example.com/legacy");
        xhr.send();

        const hero = document.createElement("div");
        hero.className = "hero";
        hero.style.backgroundImage = "url(https://cdn.example.com/hero-2.jpg)";
        document.body.appendChild(hero);
      </script>
    </body>
  </html>
`;

async function run() {
  // The settle time gives scripts a moment to execute before we snapshot results.
  const interceptor = new Lighterceptor(html, { settleTimeMs: 75 });
  const result = await interceptor.run();

  console.log("Captured title:", result.title);
  console.log("Captured at:", result.capturedAt);
  console.log("Requests:", result.requests);
}

void run();
