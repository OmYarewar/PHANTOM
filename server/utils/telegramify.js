import { spawn } from 'child_process';
import os from 'os';

export function convertMarkdown(md) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [
            '-c',
            `
import sys
import json
import asyncio
import base64
from telegramify_markdown import telegramify
from telegramify_markdown.content import ContentType

async def main():
    try:
        md = sys.stdin.read()
        results = await telegramify(md, max_message_length=4090)
        output = []
        for item in results:
            if item.content_type == ContentType.TEXT:
                output.append({
                    "type": "text",
                    "text": item.text,
                    "entities": [e.to_dict() for e in item.entities]
                })
            elif item.content_type == ContentType.FILE:
                output.append({
                    "type": "file",
                    "file_name": item.file_name,
                    "file_data": base64.b64encode(item.file_data).decode('utf-8')
                })
            elif item.content_type == ContentType.PHOTO:
                output.append({
                    "type": "photo",
                    "file_name": item.file_name,
                    "file_data": base64.b64encode(item.file_data).decode('utf-8')
                })
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
            `
        ], {
            cwd: os.homedir()
        });

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error("Python process exited with code " + code + ": " + stderrData));
                return;
            }
            try {
                const result = JSON.parse(stdoutData);
                resolve(result);
            } catch (err) {
                reject(new Error("Failed to parse Python output: " + err.message));
            }
        });

        pythonProcess.stdin.write(md);
        pythonProcess.stdin.end();
    });
}
