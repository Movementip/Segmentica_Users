import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import {
    buildDocumentRendererError,
    getDocumentRendererBaseUrls,
} from './documentRendererUrls';

const LIBREOFFICE_BIN = process.env.LIBREOFFICE_BIN || 'soffice';
const LIBREOFFICE_TIMEOUT_MS = Number(process.env.LIBREOFFICE_TIMEOUT_MS || 30000);
const GOTENBERG_URL = String(process.env.GOTENBERG_URL || '').trim().replace(/\/+$/, '');

const waitForChild = (child: ReturnType<typeof spawn>, timeoutMs: number): Promise<void> =>
    new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            reject(new Error(`LibreOffice conversion timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        child.stdout?.on('data', (chunk) => {
            stdout += String(chunk || '');
        });

        child.stderr?.on('data', (chunk) => {
            stderr += String(chunk || '');
        });

        child.on('error', (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
        });

        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code === 0) {
                resolve();
                return;
            }
            reject(
                new Error(
                    `LibreOffice exited with code ${code}. ${stderr.trim() || stdout.trim() || 'No output from converter.'}`
                )
            );
        });
    });

export const convertOfficeDocumentToPdf = async (inputPath: string): Promise<string> => {
    const sourcePath = path.resolve(inputPath);
    const sourceDir = path.dirname(sourcePath);
    const sourceBaseName = path.parse(sourcePath).name;
    const pdfPath = path.join(sourceDir, `${sourceBaseName}.pdf`);

    await fs.rm(pdfPath, { force: true }).catch(() => undefined);

    const rendererBaseUrls = getDocumentRendererBaseUrls();
    if (rendererBaseUrls.length > 0) {
        const fileBuffer = await fs.readFile(sourcePath);
        const attempts: string[] = [];

        for (const baseUrl of rendererBaseUrls) {
            const requestUrl = `${baseUrl}/convert/office-to-pdf`;
            const formData = new FormData();
            const blob = new Blob([fileBuffer], {
                type: 'application/octet-stream',
            });
            formData.append('file', blob, path.basename(sourcePath));

            try {
                const response = await fetch(requestUrl, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    attempts.push(`${requestUrl} -> ${response.status}${errorText ? `: ${errorText}` : ''}`);
                    continue;
                }

                const pdfBuffer = Buffer.from(await response.arrayBuffer());
                await fs.writeFile(pdfPath, pdfBuffer);
                return pdfPath;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown fetch error';
                attempts.push(`${requestUrl} -> ${message}`);
            }
        }

        if (!GOTENBERG_URL) {
            throw buildDocumentRendererError('convert office document to PDF', attempts);
        }
    }

    if (GOTENBERG_URL) {
        const fileBuffer = await fs.readFile(sourcePath);
        const formData = new FormData();
        const blob = new Blob([fileBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        formData.append('files', blob, path.basename(sourcePath));

        const response = await fetch(`${GOTENBERG_URL}/forms/libreoffice/convert`, {
            method: 'POST',
            headers: {
                'Gotenberg-Output-Filename': sourceBaseName,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(
                `Gotenberg conversion failed with status ${response.status}. ${errorText || 'No response body from converter.'}`
            );
        }

        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(pdfPath, pdfBuffer);
        return pdfPath;
    }

    const child = spawn(
        LIBREOFFICE_BIN,
        [
            '--headless',
            '--nologo',
            '--nolockcheck',
            '--nodefault',
            '--norestore',
            '--convert-to',
            'pdf',
            '--outdir',
            sourceDir,
            sourcePath,
        ],
        {
            stdio: ['ignore', 'pipe', 'pipe'],
        }
    );

    try {
        await waitForChild(child, LIBREOFFICE_TIMEOUT_MS);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown LibreOffice conversion error';
        throw new Error(
            `Не удалось конвертировать документ в PDF через LibreOffice. Проверьте LIBREOFFICE_BIN и доступность soffice. ${message}`
        );
    }

    await fs.access(pdfPath);
    return pdfPath;
};
