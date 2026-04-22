type BodyScrollLockState = {
    bodyOverflow: string;
    bodyOverscrollBehavior: string;
    bodyPaddingRight: string;
    htmlOverflow: string;
    htmlScrollbarGutter: string;
    scrollX: number;
    scrollY: number;
};

let lockCount = 0;
let lockState: BodyScrollLockState | null = null;
let removeScrollGuard: (() => void) | null = null;

const SCROLL_LOCK_ALLOW_SELECTOR = '[data-scroll-lock-allow="true"]';

const parsePixelValue = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const isScrollAllowedTarget = (target: EventTarget | null): boolean => {
    return target instanceof Element && Boolean(target.closest(SCROLL_LOCK_ALLOW_SELECTOR));
};

const installScrollGuard = (): (() => void) => {
    const stopBackgroundWheel = (event: WheelEvent) => {
        if (isScrollAllowedTarget(event.target)) return;
        event.preventDefault();
    };

    const stopBackgroundTouch = (event: TouchEvent) => {
        if (isScrollAllowedTarget(event.target)) return;
        event.preventDefault();
    };

    document.addEventListener('wheel', stopBackgroundWheel, { capture: true, passive: false });
    document.addEventListener('touchmove', stopBackgroundTouch, { capture: true, passive: false });

    return () => {
        document.removeEventListener('wheel', stopBackgroundWheel, { capture: true });
        document.removeEventListener('touchmove', stopBackgroundTouch, { capture: true });
    };
};

export const lockBodyScroll = (): (() => void) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return () => undefined;
    }

    lockCount += 1;

    if (!lockState) {
        const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        const currentPaddingRight = parsePixelValue(window.getComputedStyle(document.body).paddingRight);
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        lockState = {
            bodyOverflow: document.body.style.overflow,
            bodyOverscrollBehavior: document.body.style.overscrollBehavior,
            bodyPaddingRight: document.body.style.paddingRight,
            htmlOverflow: document.documentElement.style.overflow,
            htmlScrollbarGutter: document.documentElement.style.scrollbarGutter,
            scrollX,
            scrollY,
        };

        document.documentElement.style.scrollbarGutter = 'stable';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        removeScrollGuard = installScrollGuard();

        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
        }
    }

    return () => {
        lockCount = Math.max(0, lockCount - 1);

        if (lockCount > 0 || !lockState) return;

        restoreBodyScroll();
    };
};

const restoreBodyScroll = () => {
    if (typeof document === 'undefined') return;

    removeScrollGuard?.();
    removeScrollGuard = null;

    if (!lockState) return;

    const { scrollX, scrollY } = lockState;

    document.body.style.overflow = lockState.bodyOverflow;
    document.body.style.overscrollBehavior = lockState.bodyOverscrollBehavior;
    document.body.style.paddingRight = lockState.bodyPaddingRight;
    document.documentElement.style.overflow = lockState.htmlOverflow;
    document.documentElement.style.scrollbarGutter = lockState.htmlScrollbarGutter;
    lockState = null;

    if (typeof window !== 'undefined') {
        window.scrollTo(scrollX, scrollY);
    }
};

const clearBodyScrollLockStyles = () => {
    if (typeof document === 'undefined') return;

    document.documentElement.style.overflow = '';
    document.documentElement.style.scrollbarGutter = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.paddingRight = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';

    document.querySelectorAll<HTMLElement>('.radix-themes').forEach((node) => {
        if (node.style.overflow === 'hidden') {
            node.style.overflow = '';
        }
    });
};

export const forceUnlockBodyScroll = (): void => {
    if (typeof document === 'undefined') return;

    lockCount = 0;
    restoreBodyScroll();
    clearBodyScrollLockStyles();
};

export const scheduleForceUnlockBodyScroll = (): void => {
    if (typeof window === 'undefined') return;

    forceUnlockBodyScroll();
    window.requestAnimationFrame(() => {
        forceUnlockBodyScroll();
        window.setTimeout(forceUnlockBodyScroll, 0);
        window.setTimeout(forceUnlockBodyScroll, 120);
        window.setTimeout(forceUnlockBodyScroll, 320);
    });
};

type OpenInNewTabWithUnlockOptions = {
    onBeforeOpen?: () => void;
    target?: string;
    features?: string;
};

export const openInNewTabWithUnlock = (
    url: string,
    {
        onBeforeOpen,
        target = '_blank',
        features = 'noopener,noreferrer',
    }: OpenInNewTabWithUnlockOptions = {}
): Window | null => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const unlockOnReturn = () => {
        scheduleForceUnlockBodyScroll();
        window.removeEventListener('focus', unlockOnReturn);
        window.removeEventListener('pageshow', unlockOnReturn);
        document.removeEventListener('visibilitychange', unlockOnVisibilityReturn);
    };

    const unlockOnVisibilityReturn = () => {
        if (document.visibilityState === 'visible') {
            unlockOnReturn();
        }
    };

    window.addEventListener('focus', unlockOnReturn, { once: true });
    window.addEventListener('pageshow', unlockOnReturn, { once: true });
    document.addEventListener('visibilitychange', unlockOnVisibilityReturn);

    scheduleForceUnlockBodyScroll();
    onBeforeOpen?.();
    forceUnlockBodyScroll();

    const openedWindow = window.open(url, target, features);

    scheduleForceUnlockBodyScroll();
    window.setTimeout(scheduleForceUnlockBodyScroll, 0);
    window.setTimeout(scheduleForceUnlockBodyScroll, 120);
    window.setTimeout(scheduleForceUnlockBodyScroll, 320);
    window.setTimeout(scheduleForceUnlockBodyScroll, 700);

    return openedWindow;
};
