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
