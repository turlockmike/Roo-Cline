export function getFetchDescription(): string {
    return `## fetch
Description: Fetch content from a URL in various formats (HTML, JSON, text, or markdown).
Parameters:
- url: (required) The URL to fetch content from
- format: (optional) The desired format of the response (html, json, text, markdown). Defaults to html.
- headers: (optional) JSON string of request headers
Usage:
<fetch>
<url>URL to fetch from</url>
<format>Format to return (optional)</format>
<headers>Request headers as JSON string (optional)</headers>
</fetch>

Example: Requesting to fetch JSON data from an API
<fetch>
<url>https://api.example.com/data</url>
<format>json</format>
<headers>{"Authorization": "Bearer token123"}</headers>
</fetch>`;
}