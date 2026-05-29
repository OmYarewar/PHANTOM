## 2024-05-18 - [Fix XSS in Custom Markdown Parser]
**Vulnerability:** The custom Markdown parser `frontend/js/markdown.js` was vulnerable to XSS through unescaped quotes in attributes and un-sanitized link URIs, allowing `javascript:` execution.
**Learning:** The application uses a custom markdown parser that pipes its output directly to `innerHTML`. Any flaws in escaping HTML entities or sanitizing URLs in this parser can lead to DOM-based XSS, which is particularly severe given the context of AI-generated content (prompt injection).
**Prevention:** Ensure the HTML entity map includes `"` and `'`. Always sanitize URL schemes in link generation to explicitly allow only safe protocols (or neutralize dangerous ones).

## 2024-05-24 - SSRF in LLM Fetch Configuration
**Vulnerability:** The `/doctor/chat` endpoint allowed users to provide an arbitrary `baseUrl` for connecting to "OpenAI-compatible APIs." This was directly passed to `fetch` without validation, creating a Server-Side Request Forgery (SSRF) vulnerability. This could allow an attacker to send POST requests and read responses from internal/local services (e.g., `http://169.254.169.254/latest/meta-data/` on AWS).
**Learning:** Any endpoint that constructs a URL dynamically from user input and makes outbound HTTP requests must explicitly validate the structure and target of that URL.
**Prevention:** Enforce strict URL protocol validation (`http:`/`https:`) and actively block internal IP addresses and loopback hostnames (e.g., `localhost`, `127.0.0.1`, `169.254.169.254`, `0.0.0.0`, `::1`) before initiating the `fetch`.


