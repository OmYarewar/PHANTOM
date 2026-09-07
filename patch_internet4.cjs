const fs = require('fs');
let code = fs.readFileSync('server/tools/internet.js', 'utf8');

code = code.replace(
  'html.match(/href="https:\\/\\/www\\.instagram\\.com\\/([^/"]+)\\/"/i);',
  'html.match(/href="https:\\/\\/www\\.instagram\\.com\\/([^\/"]+)\\/"/i);' // this might be wrong again
);

// Actually, in JS regex: /([^/"]+)/ is valid. No need to escape the slash in the character class if we are not escaping it generally, wait, if the regex is delimited by /, then / must be escaped inside! So \/ is REQUIRED!
// The linter says: Unnecessary escape character: \/  in /href="https:\/\/www\.instagram\.com\/([^\/"]+)\/"/i
// So the escape of / in [^\/"] is unnecessary? Wait. In JS regex /[^\/]/ , the slash is the delimiter. If we don't escape it, it terminates the regex!
// But ESLint might be complaining about something else? Wait. In ES6, maybe we don't need it? NO.
// If the linter says: Unnecessary escape character: \/ on line 1145
// 1145: html.match(/href="https:\/\/www\.instagram\.com\/([^\/"]+)\/"/i);
// Maybe it's not the one inside the character class? No, it points to \/
