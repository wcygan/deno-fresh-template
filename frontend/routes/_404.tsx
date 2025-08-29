import { define } from "../utils.ts";

export default define.page(() => (
  <main class="min-h-screen flex items-center justify-center p-8">
    <div class="max-w-screen-md text-center">
      <h1 class="text-3xl font-bold mb-2">Page not found</h1>
      <p class="text-gray-600 mb-6">
        The page you’re looking for doesn’t exist.
      </p>
      <a href="/" class="underline">Go back home</a>
    </div>
  </main>
));
