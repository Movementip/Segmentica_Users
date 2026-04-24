'use client';

import React, { useEffect, useState } from 'react';

import styles from './ViewportGuard.module.css';

const MIN_VIEWPORT_WIDTH = 1305;
const MIN_VIEWPORT_HEIGHT = 700;

const isViewportBlocked = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.innerWidth < MIN_VIEWPORT_WIDTH || window.innerHeight < MIN_VIEWPORT_HEIGHT;
};

export function ViewportGuard({ children }: { children: React.ReactNode }): JSX.Element {
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        const updateViewportState = () => {
            setBlocked(isViewportBlocked());
        };

        updateViewportState();
        window.addEventListener('resize', updateViewportState);
        window.addEventListener('orientationchange', updateViewportState);

        return () => {
            window.removeEventListener('resize', updateViewportState);
            window.removeEventListener('orientationchange', updateViewportState);
        };
    }, []);

    return (
        <div className={styles.root}>
            <div className={`${styles.content} ${blocked ? styles.contentBlocked : ''}`}>
                {children}
            </div>

            {blocked ? (
                <div className={styles.overlay} aria-hidden="true">
                    <div className={styles.panel}>
                        <h1 className={styles.title}>Увеличьте окно</h1>
                        <p className={styles.description}>
                            Интерфейс временно заблокирован. Для работы нужен более широкий и высокий экран.
                        </p>
                        <p className={styles.limits}>
                            Минимум: 1305px по ширине и 700px по высоте.
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
