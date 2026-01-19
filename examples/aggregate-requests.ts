import { Lighterceptor } from "../src/index";

const html = `
  <!doctype html>
  <html>
    <head>
      <link rel="stylesheet" href="https://cdn.example.com/base.css" />
    </head>
    <body>
      <img src="https://cdn.example.com/icons/icon-1.png" />
      <img src="https://cdn.example.com/icons/icon-2.png" />
      <script>
        fetch("https://api.example.com/v1/search");
        fetch("https://api.example.com/v1/profile");
      </script>
    </body>
  </html>
`;

async function run() {
  const result = await new Lighterceptor(html).run();

  // Aggregate counts by source so you can spot the noisier channels quickly.
  const counts = new Map<string, number>();
  for (const request of result.requests) {
    const current = counts.get(request.source) ?? 0;
    counts.set(request.source, current + 1);
  }

  // Sort the summary for predictable output in logs or docs.
  const summary = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([source, total]) => `${source}: ${total}`);

  console.log("Request summary:", summary);
  console.log("Full request list:", result.requests);
}

void run();
