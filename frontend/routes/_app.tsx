import { define } from "../utils.ts";
import { Head } from "fresh/runtime";

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>frontend</title>
        <meta name="description" content="Deno Fresh starter template" />
        <meta name="theme-color" content="#10b981" />
        <meta property="og:title" content="frontend" />
        <meta property="og:description" content="Deno Fresh starter template" />
        <link rel="stylesheet" href="/styles.css" />
        <Head />
      </head>
      <body>
        <Component />
        {/* Fresh injects scripts automatically in v2 */}
      </body>
    </html>
  );
});
