"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";

const SpokeWebhookDocs = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Skip to content link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded"
      >
        Skip to main content
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <main id="main-content" className="lg:col-span-9">
            <article>
              {/* Version Badge */}
              <Badge variant="secondary" className="mb-6">
                Version: v0.2b
              </Badge>

              {/* Mobile TOC Button */}
              <button className="lg:hidden w-full mb-6 px-4 py-2 border rounded-lg text-left hover:bg-gray-50">
                On this page
              </button>

              {/* Content */}
              <div className="prose prose-slate max-w-none">
                {/* Section 1 */}
                <h2 id="preparing-to-receive-a-webhook-notification" className="text-2xl font-bold text-gray-900 mb-4 scroll-mt-20">
                  Preparing to receive a Webhook Notification
                  <a 
                    href="#preparing-to-receive-a-webhook-notification" 
                    className="ml-2 text-blue-600 hover:text-blue-800 no-underline"
                    aria-label="Direct link to Preparing to receive a Webhook Notification"
                  >
                    ​
                  </a>
                </h2>

                <p className="text-gray-700 mb-4">
                  Before enabling Spoke to send you Webhook notifications you must make sure
                  you are prepared to receive them:
                </p>

                <ol className="list-decimal list-inside space-y-2 mb-8 text-gray-700">
                  <li>You will need to implement an HTTPS endpoint to receive POST requests.</li>
                  <li>
                    For each request received from Spoke, your endpoint needs to answer with a{" "}
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">2xx</code> status code.
                  </li>
                  <li>
                    Spoke will not transfer any data on unsafe connections. So please, ensure
                    your created endpoint is both public, and can handle HTTPS connections. We
                    accept endpoints with self-signed keys.
                  </li>
                </ol>

                {/* Section 2 */}
                <h2 id="enabling-the-webhook-notifications" className="text-2xl font-bold text-gray-900 mb-4 scroll-mt-20">
                  Enabling the Webhook Notifications
                  <a 
                    href="#enabling-the-webhook-notifications" 
                    className="ml-2 text-blue-600 hover:text-blue-800 no-underline"
                    aria-label="Direct link to Enabling the Webhook Notifications"
                  >
                    ​
                  </a>
                </h2>

                {/* Subsection 2.1 */}
                <h3 id="go-to-the-settings-page" className="text-xl font-semibold text-gray-900 mb-3 scroll-mt-20">
                  Go to the settings page
                  <a 
                    href="#go-to-the-settings-page" 
                    className="ml-2 text-blue-600 hover:text-blue-800 no-underline"
                    aria-label="Direct link to Go to the settings page"
                  >
                    ​
                  </a>
                </h3>

                <ol className="list-decimal list-inside mb-6">
                  <li className="text-gray-700 mb-4">
                    <p className="inline">
                      Finally, to enable receiving messages from Spoke, go to your team's{" "}
                      <a 
                        href="https://dispatch.spoke.com/settings" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        settings page
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      , on the <code className="bg-gray-100 px-2 py-1 rounded text-sm">API</code> sidebar:
                    </p>
                    <img 
                      src="/assets/placeholder.svg" 
                      alt="Sidebar Location" 
                      className="mt-4 border rounded-lg shadow-sm max-w-full"
                    />
                  </li>
                </ol>

                {/* Subsection 2.2 */}
                <h3 id="fill-your-endpoint-url" className="text-xl font-semibold text-gray-900 mb-3 scroll-mt-20">
                  Fill your endpoint URL
                  <a 
                    href="#fill-your-endpoint-url" 
                    className="ml-2 text-blue-600 hover:text-blue-800 no-underline"
                    aria-label="Direct link to Fill your endpoint URL"
                  >
                    ​
                  </a>
                </h3>

                <ol className="list-decimal list-inside mb-6">
                  <li className="text-gray-700 mb-4">
                    <p className="inline">Now, fill in your endpoint URL:</p>
                    <img 
                      src="/assets/placeholder.svg" 
                      alt="Webhook Endpoint" 
                      className="mt-4 border rounded-lg shadow-sm max-w-full"
                    />
                  </li>
                </ol>

                {/* Subsection 2.3 */}
                <h3 id="select-the-api-version" className="text-xl font-semibold text-gray-900 mb-3 scroll-mt-20">
                  Select the API version
                  <a 
                    href="#select-the-api-version" 
                    className="ml-2 text-blue-600 hover:text-blue-800 no-underline"
                    aria-label="Direct link to Select the API version"
                  >
                    ​
                  </a>
                </h3>

                <ol className="list-decimal list-inside mb-6">
                  <li className="text-gray-700 mb-4">
                    <p className="inline">
                      Now, select the webhook API version, this will dictate what{" "}
                      <a href="/docs/webhook-events" className="text-blue-600 hover:underline">
                        messages
                      </a>{" "}
                      you receive.
                    </p>
                    <img 
                      src="/assets/placeholder.svg" 
                      alt="Webhook Version" 
                      className="mt-4 border rounded-lg shadow-sm max-w-full"
                    />
                  </li>
                </ol>

                {/* Subsection 2.4 */}
                <h3 id="test-your-webhook" className="text-xl font-semibold text-gray-900 mb-3 scroll-mt-20">
                  Test your webhook
                  <a 
                    href="#test-your-webhook" 
                    className="ml-2 text-blue-600 hover:text-blue-800 no-underline"
                    aria-label="Direct link to Test your webhook"
                  >
                    ​
                  </a>
                </h3>

                <ol className="list-decimal list-inside mb-6 space-y-4">
                  <li className="text-gray-700">
                    <p className="inline">
                      Now, you can test your webhook, to do this, click on the test button. You
                      will either receive an error with why it failed or a success message.
                    </p>
                    <img 
                      src="/assets/placeholder.svg" 
                      alt="Webhook Test" 
                      className="mt-4 border rounded-lg shadow-sm max-w-full"
                    />
                  </li>
                  <li className="text-gray-700">
                    <p className="inline">If everything goes well with your test, you can now enable the webhook:</p>
                    <img 
                      src="/assets/placeholder.svg" 
                      alt="Enable Webhook" 
                      className="mt-4 border rounded-lg shadow-sm max-w-full"
                    />
                  </li>
                </ol>

                {/* Subsection 2.5 */}
                <h3 id="what-now" className="text-xl font-semibold text-gray-900 mb-3 scroll-mt-20">
                  What now?
                  <a 
                    href="#what-now" 
                    className="ml-2 text-blue-600 hover:text-blue-800 no-underline"
                    aria-label="Direct link to What now?"
                  >
                    ​
                  </a>
                </h3>

                <div className="space-y-2 text-gray-700">
                  <p>
                    You can check a quick guide on{" "}
                    <a href="/docs/getting-started/consuming-the-webhook-notifications" className="text-blue-600 hover:underline">
                      Implementing the Endpoint
                    </a>
                  </p>

                  <p>
                    You can check the supported{" "}
                    <a href="/docs/webhook-events" className="text-blue-600 hover:underline">
                      Webhook Events
                    </a>
                  </p>

                  <p>
                    You can check how to add{" "}
                    <a href="/docs/getting-started/securing-the-endpoint" className="text-blue-600 hover:underline">
                      signature verification
                    </a>
                  </p>

                  <p>
                    And finally, we recommend some{" "}
                    <a href="/docs/getting-started/best-practices" className="text-blue-600 hover:underline">
                      best practices
                    </a>{" "}
                    on consuming the API.
                  </p>
                </div>
              </div>
            </article>
          </main>

          {/* Table of Contents Sidebar */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-8">
              <nav className="space-y-1">
                <p className="text-sm font-semibold text-gray-900 mb-3">On this page</p>
                <ul className="space-y-2 text-sm border-l-2 border-gray-200 pl-4">
                  <li>
                    <a 
                      href="#preparing-to-receive-a-webhook-notification" 
                      className="text-blue-600 hover:text-blue-800 block py-1"
                    >
                      Preparing to receive a Webhook Notification
                    </a>
                  </li>
                  <li>
                    <a 
                      href="#enabling-the-webhook-notifications" 
                      className="text-gray-700 hover:text-gray-900 block py-1"
                    >
                      Enabling the Webhook Notifications
                    </a>
                    <ul className="ml-4 mt-2 space-y-2">
                      <li>
                        <a 
                          href="#go-to-the-settings-page" 
                          className="text-gray-600 hover:text-gray-800 block py-1"
                        >
                          Go to the settings page
                        </a>
                      </li>
                      <li>
                        <a 
                          href="#fill-your-endpoint-url" 
                          className="text-gray-600 hover:text-gray-800 block py-1"
                        >
                          Fill your endpoint URL
                        </a>
                      </li>
                      <li>
                        <a 
                          href="#select-the-api-version" 
                          className="text-gray-600 hover:text-gray-800 block py-1"
                        >
                          Select the API version
                        </a>
                      </li>
                      <li>
                        <a 
                          href="#test-your-webhook" 
                          className="text-gray-600 hover:text-gray-800 block py-1"
                        >
                          Test your webhook
                        </a>
                      </li>
                      <li>
                        <a 
                          href="#what-now" 
                          className="text-gray-600 hover:text-gray-800 block py-1"
                        >
                          What now?
                        </a>
                      </li>
                    </ul>
                  </li>
                </ul>
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SpokeWebhookDocs;