## 2026-05-16 - [Accessibility Gaps in Modals and Hidden Panels]
**Learning:** [Form labels and icon-only buttons within modals and hidden panels (e.g., AI Doctor, Management panels) in this app consistently lack accessibility attributes compared to the main UI. This appears to be a systemic issue when components are hidden by default.]
**Action:** [When reviewing or adding new modals and hidden panels, explicitly check for and add `for` attributes to `<label>` tags and `aria-label` attributes to icon-only buttons.]
