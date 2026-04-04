
declare module "*.svg" {
    const content: React.FunctionComponent<React.SVGAttributes<SVGAElement>>;
    export default content;
}

// this file is conditionally added/removed to next-env.d.ts
// if the static image import handling is enabled

interface StaticImageData {
    src: string
    height: number
    width: number
    placeholder?: string
}

declare module '*.png' {
    const content: StaticImageData;
    export default content;
}


declare module '*.jpg' {
    const content: StaticImageData;
    export default content;
}

declare module '*.jpeg' {
    const content: StaticImageData;
    export default content;
}

declare module '*.gif' {
    const content: StaticImageData;
    export default content;
}

declare module '*.webp' {
    const content: StaticImageData;
    export default content;
}

declare module '*.ico' {
    const content: StaticImageData;
    export default content;
}

declare module '*.bmp' {
    const content: StaticImageData;
    export default content;
}

declare module '/pdfjs/pdf.mjs' {
    export const GlobalWorkerOptions: {
        workerSrc: string;
    };

    export function getDocument(source: { data: Uint8Array }): {
        promise: Promise<{
            numPages: number;
            getPage(pageNumber: number): Promise<{
                getViewport(params: { scale: number }): {
                    width: number;
                    height: number;
                };
                render(params: {
                    canvasContext: CanvasRenderingContext2D;
                    viewport: {
                        width: number;
                        height: number;
                    };
                    background: string;
                }): {
                    promise: Promise<void>;
                };
            }>;
        }>;
    };
}
