export type DocumentPreviewStateBase = {
    title: string;
    description: string;
    fileNameBase: string;
    previewUrl: string;
};

export type DocumentPreviewPageImage = {
    src: string;
    width: number;
    height: number;
};

export type PdfJsModule = {
    GlobalWorkerOptions: {
        workerSrc: string;
    };
    getDocument: (source: { data: Uint8Array }) => {
        promise: Promise<{
            numPages: number;
            getPage: (pageNumber: number) => Promise<{
                getViewport: (params: { scale: number }) => { width: number; height: number };
                render: (params: {
                    canvasContext: CanvasRenderingContext2D;
                    viewport: { width: number; height: number };
                    background: string;
                }) => { promise: Promise<void> };
            }>;
        }>;
    };
};
