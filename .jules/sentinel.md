## 2024-05-18 - [Fix XSS in Custom Markdown Parser]
**Vulnerability:** The custom Markdown parser `frontend/js/markdown.js` was vulnerable to XSS through unescaped quotes in attributes and un-sanitized link URIs, allowing `javascript:` execution.
**Learning:** The application uses a custom markdown parser that pipes its output directly to `innerHTML`. Any flaws in escaping HTML entities or sanitizing URLs in this parser can lead to DOM-based XSS, which is particularly severe given the context of AI-generated content (prompt injection).
**Prevention:** Ensure the HTML entity map includes `"` and `'`. Always sanitize URL schemes in link generation to explicitly allow only safe protocols (or neutralize dangerous ones).
