type BodyScrollLockState = {
    bodyOverflow: string;
    bodyPaddingRight: string;
    htmlScrollbarGutter: string;
};

let lockCount = 0;
let lockState: BodyScrollLockState | null = null;

const parsePixelValue = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const lockBodyScroll = (): (() => void) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return () => undefined;
    }

    lockCount += 1;

    if (!lockState) {
        const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        const currentPaddingRight = parsePixelValue(window.getComputedStyle(document.body).paddingRight);

        lockState = {
            bodyOverflow: document.body.style.overflow,
            bodyPaddingRight: document.body.style.paddingRight,
            htmlScrollbarGutter: document.documentElement.style.scrollbarGutter,
        };

        document.documentElement.style.scrollbarGutter = 'stable';
        document.body.style.overflow = 'hidden';

        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
        }
    }

    return () => {
        lockCount = Math.max(0, lockCount - 1);

        if (lockCount > 0 || !lockState) return;

        document.body.style.overflow = lockState.bodyOverflow;
        document.body.style.paddingRight = lockState.bodyPaddingRight;
        document.documentElement.style.scrollbarGutter = lockState.htmlScrollbarGutter;
        lockState = null;
    };
};
